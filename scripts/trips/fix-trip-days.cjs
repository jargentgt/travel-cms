#!/usr/bin/env node
const { MongoClient, ObjectId } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function fixTripDays(tripId, expectedStartDate) {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('❌ MongoDB URI not found in environment variables')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db('travel-cms')
    const tripsCollection = db.collection('trips')
    const activitiesCollection = db.collection('activities')
    
    // Get the trip
    const trip = await tripsCollection.findOne({ _id: new ObjectId(tripId) })
    if (!trip) {
      console.error(`❌ Trip ${tripId} not found`)
      return
    }
    
    console.log(`📍 Trip: ${trip.title}`)
    console.log(`📅 Current days: ${trip.days?.length || 0}`)
    
    // Get all activities for this trip
    const activities = await activitiesCollection.find({ 
      trip: new ObjectId(tripId) 
    }).sort({ date: 1 }).toArray()
    
    console.log(`🎯 Found ${activities.length} activities`)
    
    if (activities.length === 0) {
      console.log('⚠️ No activities found for this trip')
      return
    }
    
    // Group activities by date
    const dayGroups = {}
    activities.forEach(activity => {
      const dateKey = activity.date.toISOString().split('T')[0]
      if (!dayGroups[dateKey]) {
        dayGroups[dateKey] = []
      }
      dayGroups[dateKey].push(activity._id.toString())
    })
    
    // Create new days array
    const newDays = Object.entries(dayGroups)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([dateKey, activityIds]) => ({
        date: new Date(dateKey),
        activities: activityIds
      }))
    
    console.log('\n📋 Rebuilt days:')
    newDays.forEach((day, index) => {
      console.log(`  Day ${index}: ${day.date.toISOString().split('T')[0]} (${day.activities.length} activities)`)
    })
    
    // Check if first day matches expected start date
    const firstDay = newDays[0]?.date.toISOString().split('T')[0]
    console.log(`\n🔍 Expected start date: ${expectedStartDate}`)
    console.log(`🔍 Actual start date: ${firstDay}`)
    
    if (firstDay !== expectedStartDate) {
      console.log(`⚠️ Date mismatch! Expected ${expectedStartDate} but got ${firstDay}`)
    }
    
    // Update the trip
    const result = await tripsCollection.updateOne(
      { _id: new ObjectId(tripId) },
      { 
        $set: { 
          days: newDays,
          updatedAt: new Date()
        }
      }
    )
    
    if (result.modifiedCount > 0) {
      console.log('✅ Trip days updated successfully!')
    } else {
      console.log('⚠️ No changes made to trip days')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2)
  const tripId = args[0]
  const expectedStartDate = args[1]
  
  if (!tripId || !expectedStartDate) {
    console.log('Usage: node fix-trip-days.cjs <tripId> <expectedStartDate>')
    console.log('Example: node fix-trip-days.cjs 68b474b171c114485c247b4b 2025-09-20')
    process.exit(1)
  }
  
  fixTripDays(tripId, expectedStartDate)
}

module.exports = { fixTripDays } 