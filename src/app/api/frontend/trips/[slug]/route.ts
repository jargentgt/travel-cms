import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCorsHeaders, handleOptionsRequest } from '../../../../../utils/cors'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return handleOptionsRequest(origin || undefined)
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const payload = await getPayload({ config })
    const { slug } = await context.params
    const origin = request.headers.get('origin')

    if (!slug) {
      return NextResponse.json(
        { success: false, message: 'Trip slug is required' },
        { 
          status: 400,
          headers: getCorsHeaders(origin || undefined)
        }
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
      return NextResponse.json(
        { success: false, message: 'Trip not found' },
        { 
          status: 404,
          headers: getCorsHeaders(origin || undefined)
        }
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
      depth: 0
    })

    // Group activities by date
    const activitiesByDate: { [key: string]: any[] } = {}
    activities.docs.forEach(activity => {
      const dateKey = new Date(activity.date).toISOString().split('T')[0]
      if (!activitiesByDate[dateKey]) {
        activitiesByDate[dateKey] = []
      }
      // Create coordinates object from flattened fields for frontend compatibility
      const coordinates = activity.latitude && activity.longitude ? {
        lat: activity.latitude,
        lng: activity.longitude,
        source: activity.coordinatesSource || 'google'
      } : null

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
        coordinates: coordinates
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

    return NextResponse.json(
      {
        success: true,
        data: formattedTrip
      },
      {
        status: 200,
        headers: getCorsHeaders(origin || undefined)
      }
    )

  } catch (error) {
    console.error('❌ Error fetching trip detail:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const origin = request.headers.get('origin')
    
    return NextResponse.json(
      {
        success: false,
        message: `Error fetching trip detail: ${errorMessage}`,
        data: null
      },
      { 
        status: 500,
        headers: getCorsHeaders(origin || undefined)
      }
    )
  }
} 