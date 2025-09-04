import type { Endpoint } from 'payload'
import { createCorsResponse, handleOptionsRequest } from '../utils/cors'

const tripsList: Endpoint = {
  path: '/frontend/trips',
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
      
      // Get query parameters
      const limit = url ? parseInt(url.searchParams.get('limit') || '12') : 12
      const page = url ? parseInt(url.searchParams.get('page') || '1') : 1
      const category = url ? url.searchParams.get('category') : null
      const search = url ? url.searchParams.get('search') : null

      if (!payload) {
        return createCorsResponse(
          { success: false, message: 'Payload instance not available' },
          500,
          origin
        )
      }

      // Build query conditions
      const where: any = {
        status: { equals: 'published' }
      }

      if (category) {
        where.categories = { contains: category }
      }

      if (search) {
        where.or = [
          { title: { contains: search } },
          { location: { contains: search } },
          { country: { contains: search } },
          { tags: { contains: search } }
        ]
      }

      // Fetch trips
      const trips = await payload.find({
        collection: 'trips',
        where,
        limit,
        page,
        sort: '-startDate',
        depth: 2
      })

      // Format response for frontend
      const formattedTrips = trips.docs.map(trip => ({
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
        daysCount: trip.days?.length || 0
      }))

      return createCorsResponse({
        success: true,
        data: {
          trips: formattedTrips,
          totalDocs: trips.totalDocs,
          totalPages: trips.totalPages,
          page: trips.page,
          limit: trips.limit,
          hasNextPage: trips.hasNextPage,
          hasPrevPage: trips.hasPrevPage
        }
      }, 200, origin)

    } catch (error) {
      console.error('❌ Error fetching trips:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return createCorsResponse(
        {
          success: false,
          message: `Error fetching trips: ${errorMessage}`,
          data: null
        },
        500,
        origin
      )
    }
  },
}

export default tripsList 