import type { Endpoint } from 'payload'
import { updateActivitiesForTrip, updateActivitiesForAllTrips } from '../utilities/updateActivitiesCategories'

const updateActivitiesCategories: Endpoint = {
  path: '/update-activities-categories',
  method: 'get',
  handler: async (req) => {
    try {
      const { payload } = req
      const url = req.url ? new URL(req.url) : null
      const tripId = url ? url.searchParams.get('tripId') : null

      if (!payload) {
        return Response.json(
          { success: false, message: 'Payload instance not available' },
          { status: 500 }
        )
      }

      let result

      if (tripId) {
        // Update activities for specific trip
        console.log(`🎯 Updating activities for trip: ${tripId}`)
        result = await updateActivitiesForTrip(payload, tripId)
      } else {
        // Update activities for all trips
        console.log(`🌍 Updating activities for all trips`)
        result = await updateActivitiesForAllTrips(payload)
      }

      const status = result.success ? 200 : 500

      return Response.json(result, { status })

    } catch (error) {
      console.error('❌ Endpoint error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return Response.json(
        {
          success: false,
          message: `Endpoint error: ${errorMessage}`,
          totalActivities: 0,
          updatedCount: 0,
          categoryDistribution: {},
        },
        { status: 500 }
      )
    }
  },
}

export default updateActivitiesCategories 