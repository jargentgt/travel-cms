#!/usr/bin/env node

/**
 * Analysis script to check trip reference data consistency in MongoDB (DRY RUN - NO CHANGES)
 * 
 * Usage: node analyze-trip-references.cjs [MONGODB_URI] [DB_NAME]
 */

const { MongoClient, ObjectId } = require('mongodb')

async function analyzeTripReferences(mongoUri, dbName = 'travel-cms') {
  if (!mongoUri) {
    console.error('❌ Error: MongoDB URI is required')
    console.log('\n📝 Usage:')
    console.log('  node analyze-trip-references.cjs <MONGODB_URI> [DB_NAME]')
    process.exit(1)
  }

  console.log('🔗 Connecting to Production MongoDB (READ-ONLY)...')
  console.log(`📍 Database: ${dbName}`)
  console.log(`🔗 URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`)
  
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    const db = client.db(dbName)
    
    // List all collections
    console.log('\n📋 Collections in database:')
    const collections = await db.listCollections().toArray()
    for (const collection of collections) {
      console.log(`  - ${collection.name}`)
    }
    
    // Get collections
    const activitiesCollection = db.collection('activities')
    const tripsCollection = db.collection('trips')
    
    console.log('\n📊 Data Analysis:')
    
    // Check current state
    const totalTrips = await tripsCollection.countDocuments()
    const totalActivities = await activitiesCollection.countDocuments()
    const activitiesWithStringTrip = await activitiesCollection.countDocuments({
      trip: { $type: "string" }
    })
    const activitiesWithObjectIdTrip = await activitiesCollection.countDocuments({
      trip: { $type: "objectId" }
    })
    
    console.log(`📈 Total trips: ${totalTrips}`)
    console.log(`📈 Total activities: ${totalActivities}`)
    console.log(`🔗 Activities with string trip reference: ${activitiesWithStringTrip}`)
    console.log(`✅ Activities with ObjectId trip reference: ${activitiesWithObjectIdTrip}`)
    
    if (totalTrips > 0) {
      console.log('\n📋 Sample trips:')
      const sampleTrips = await tripsCollection.find().limit(3).toArray()
      for (const trip of sampleTrips) {
        console.log(`  ${trip._id}: "${trip.title}" (${trip.slug})`)
      }
    }
    
    if (activitiesWithStringTrip > 0) {
      console.log('\n🔍 Sample activities with string trip references:')
      const samples = await activitiesCollection.find({
        trip: { $type: "string" }
      }).limit(5).toArray()
      
      for (const activity of samples) {
        console.log(`  ${activity._id}: "${activity.title}"`)
        console.log(`    -> trip: "${activity.trip}" (${typeof activity.trip})`)
        
        // Check if the referenced trip exists
        if (ObjectId.isValid(activity.trip)) {
          const tripExists = await tripsCollection.findOne({ _id: new ObjectId(activity.trip) })
          if (tripExists) {
            console.log(`    -> Referenced trip EXISTS: "${tripExists.title}"`)
          } else {
            console.log(`    -> Referenced trip NOT FOUND`)
          }
        } else {
          console.log(`    -> Invalid ObjectId format`)
        }
      }
      
      console.log('\n🔧 Recommendations:')
      console.log(`  • ${activitiesWithStringTrip} activities need trip reference conversion`)
      console.log(`  • Run fix-trip-references-prod.cjs to convert string refs to ObjectIds`)
      console.log(`  • This will enable proper trip-activity relationships in the API`)
      
    } else if (totalActivities === 0) {
      console.log('\n📝 Note: No activities found in database')
    } else {
      console.log('\n🎉 All trip references are already properly formatted as ObjectIds!')
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
  console.log('🔍 Production Database Analysis (READ-ONLY)')
  console.log('=' .repeat(50))
  
  analyzeTripReferences(mongoUri, dbName)
    .then(() => {
      console.log('\n✨ Analysis completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Analysis failed:', error.message)
      process.exit(1)
    })
} 