#!/usr/bin/env node

/**
 * Production script to fix trip reference data consistency in MongoDB
 * 
 * Usage: node fix-trip-references-prod.cjs [MONGODB_URI] [DB_NAME]
 * 
 * Problem: Activities have 'trip' field as string instead of ObjectId reference
 * Solution: Convert string trip IDs to proper ObjectId references
 */

const { MongoClient, ObjectId } = require('mongodb')

async function fixTripReferences(mongoUri, dbName = 'travel-cms') {
  if (!mongoUri) {
    console.error('❌ Error: MongoDB URI is required')
    console.log('\n📝 Usage:')
    console.log('  node fix-trip-references-prod.cjs <MONGODB_URI> [DB_NAME]')
    console.log('\n📝 Example:')
    console.log('  node fix-trip-references-prod.cjs "mongodb://user:pass@host:port/database" travel-cms')
    process.exit(1)
  }

  console.log('🔗 Connecting to Production MongoDB...')
  console.log(`📍 Database: ${dbName}`)
  console.log(`🔗 URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`) // Hide credentials
  
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    const db = client.db(dbName)
    
    // Get collections
    const activitiesCollection = db.collection('activities')
    const tripsCollection = db.collection('trips')
    
    console.log('\n📊 Analyzing data...')
    
    // Check current state
    const totalActivities = await activitiesCollection.countDocuments()
    const activitiesWithStringTrip = await activitiesCollection.countDocuments({
      trip: { $type: "string" }
    })
    const activitiesWithObjectIdTrip = await activitiesCollection.countDocuments({
      trip: { $type: "objectId" }
    })
    
    console.log(`📈 Total activities: ${totalActivities}`)
    console.log(`🔗 Activities with string trip reference: ${activitiesWithStringTrip}`)
    console.log(`✅ Activities with ObjectId trip reference: ${activitiesWithObjectIdTrip}`)
    
    if (activitiesWithStringTrip === 0) {
      console.log('\n🎉 No fixes needed! All trip references are already ObjectIds.')
      return
    }
    
    // Show a few sample problematic activities
    console.log('\n📋 Sample activities with string trip references:')
    const samples = await activitiesCollection.find({
      trip: { $type: "string" }
    }).limit(5).toArray()
    
    for (const activity of samples) {
      console.log(`  ${activity._id}: "${activity.title}" -> trip: "${activity.trip}"`)
    }
    
    // Ask for confirmation before making changes
    console.log('\n⚠️  WARNING: This will modify the production database!')
    console.log('🔧 Ready to fix trip references...')
    
    // Get all activities with string trip references
    const problematicActivities = await activitiesCollection.find({
      trip: { $type: "string" }
    }).toArray()
    
    console.log('\n🔧 Starting fixes...')
    
    let fixedCount = 0
    let errorCount = 0
    
    for (const activity of problematicActivities) {
      try {
        const tripId = activity.trip
        
        // Validate that the trip ID is a valid ObjectId string
        if (!ObjectId.isValid(tripId)) {
          console.log(`⚠️  Skipping activity ${activity._id}: Invalid trip ID format: ${tripId}`)
          errorCount++
          continue
        }
        
        // Check if the referenced trip exists
        const tripExists = await tripsCollection.findOne({ _id: new ObjectId(tripId) })
        if (!tripExists) {
          console.log(`⚠️  Skipping activity ${activity._id}: Referenced trip ${tripId} not found`)
          errorCount++
          continue
        }
        
        // Convert string to ObjectId
        const result = await activitiesCollection.updateOne(
          { _id: activity._id },
          { $set: { trip: new ObjectId(tripId) } }
        )
        
        if (result.modifiedCount === 1) {
          console.log(`✅ Fixed activity ${activity._id}: "${activity.title}" -> trip: ${tripId}`)
          fixedCount++
        } else {
          console.log(`❌ Failed to update activity ${activity._id}`)
          errorCount++
        }
        
      } catch (error) {
        console.log(`❌ Error fixing activity ${activity._id}: ${error.message}`)
        errorCount++
      }
    }
    
    console.log('\n📊 Results:')
    console.log(`✅ Successfully fixed: ${fixedCount} activities`)
    console.log(`❌ Errors: ${errorCount} activities`)
    
    // Verify the fixes
    const remainingStringRefs = await activitiesCollection.countDocuments({
      trip: { $type: "string" }
    })
    const newObjectIdRefs = await activitiesCollection.countDocuments({
      trip: { $type: "objectId" }
    })
    
    console.log('\n📈 Final state:')
    console.log(`🔗 Activities with string trip reference: ${remainingStringRefs}`)
    console.log(`✅ Activities with ObjectId trip reference: ${newObjectIdRefs}`)
    
    if (remainingStringRefs === 0) {
      console.log('\n🎉 All trip references successfully converted to ObjectIds!')
      console.log('🚀 The API should now properly populate trip relationships!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\n🔌 Database connection closed')
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const mongoUri = args[0]
const dbName = args[1] || 'travel-cms'

// Run the script
if (require.main === module) {
  console.log('🚀 Production Trip Reference Fix Script')
  console.log('=' .repeat(50))
  
  fixTripReferences(mongoUri, dbName)
    .then(() => {
      console.log('\n✨ Script completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message)
      process.exit(1)
    })
} 