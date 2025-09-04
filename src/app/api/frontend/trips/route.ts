import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCorsHeaders, handleOptionsRequest } from '../../../../utils/cors'

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return handleOptionsRequest(origin || undefined)
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    
    // Get query parameters
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const page = parseInt(url.searchParams.get('page') || '1')
    const category = url.searchParams.get('category')
    const search = url.searchParams.get('search')

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

    return NextResponse.json(
      {
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
      },
      {
        status: 200,
        headers: getCorsHeaders(origin || undefined)
      }
    )

  } catch (error) {
    console.error('❌ Error fetching trips:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const origin = request.headers.get('origin')
    
    return NextResponse.json(
      {
        success: false,
        message: `Error fetching trips: ${errorMessage}`,
        data: null
      },
      { 
        status: 500,
        headers: getCorsHeaders(origin || undefined)
      }
    )
  }
} 