import type { Endpoint } from 'payload'
import { createCorsResponse, handleOptionsRequest } from '../utils/cors'

const tripDetail: Endpoint = {
  path: '/frontend/trips/[slug]',
  method: 'get',
  handler: async (req) => {
    const origin = req.headers?.get?.('origin') || undefined

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return handleOptionsRequest(origin)
    }

    try {
      const { payload } = req
      const url = req.url ? new URL(req.url) : null
      const pathSegments = url?.pathname.split('/') || []
      const slug = pathSegments[pathSegments.length - 1]

      if (!payload) {
        return createCorsResponse(
          { success: false, message: 'Payload instance not available' },
          500,
          origin
        )
      }

      if (!slug) {
        return createCorsResponse(
          { success: false, message: 'Trip slug is required' },
          400,
          origin
        )
      }

      // Fetch trip by slug
      const trips = await payload.find({
        collection: 'trips',
        where: {
          slug: { equals: slug },
          status: { equals: 'published' }
        },
        limit: 1,
        depth: 3
      })

      if (trips.docs.length === 0) {
        return createCorsResponse(
          { success: false, message: 'Trip not found' },
          404,
          origin
        )
      }

      const trip = trips.docs[0]

      // Fetch all activities for this trip
      const activities = await payload.find({
        collection: 'activities',
        where: {
          trip: { equals: trip.id }
        },
        limit: 1000,
        sort: ['date', 'order'],
        depth: 1
      })

      // Group activities by date
      const activitiesByDate: { [key: string]: any[] } = {}
      activities.docs.forEach((activity: any) => {
        const dateKey = new Date(activity.date).toISOString().split('T')[0]
        if (!activitiesByDate[dateKey]) {
          activitiesByDate[dateKey] = []
        }
        activitiesByDate[dateKey].push({
          id: activity.id,
          title: activity.title,
          time: activity.time,
          location: activity.location,
          description: activity.description,
          category: activity.category,
          type: activity.type,
          icon: activity.icon,
          order: activity.order,
          coordinates: activity.coordinates
        })
      })

      // Sort activities within each day by order
      Object.keys(activitiesByDate).forEach(date => {
        activitiesByDate[date].sort((a, b) => (a.order || 0) - (b.order || 0))
      })

      // Format trip days with activities
      const formattedDays = trip.days?.map(day => {
        const dateKey = new Date(day.date).toISOString().split('T')[0]
        return {
          date: day.date,
          activities: activitiesByDate[dateKey] || []
        }
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []

      // Format response for frontend
      const formattedTrip = {
        id: trip.id,
        title: trip.title,
        slug: trip.slug,
        location: trip.location,
        country: trip.country,
        startDate: trip.startDate,
        endDate: trip.endDate,
        categories: trip.categories,
        tags: trip.tags,
        coverImage: trip.coverImage && typeof trip.coverImage === 'object' ? {
          id: trip.coverImage.id,
          url: trip.coverImage.url,
          alt: trip.coverImage.alt,
          filename: trip.coverImage.filename
        } : null,
        days: formattedDays,
        totalDays: formattedDays.length,
        totalActivities: activities.totalDocs
      }

      return createCorsResponse({
        success: true,
        data: formattedTrip
      }, 200, origin)

    } catch (error) {
      console.error('❌ Error fetching trip detail:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return createCorsResponse(
        {
          success: false,
          message: `Error fetching trip detail: ${errorMessage}`,
          data: null
        },
        500,
        origin
      )
    }
  },
}

export default tripDetail 