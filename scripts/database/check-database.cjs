#!/usr/bin/env node

/**
 * Diagnostic script to check what's in the MongoDB database
 */

const { MongoClient, ObjectId } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function checkDatabase() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const dbName = process.env.DATABASE_NAME || 'travel-cms'
  
  if (!mongoUri) {
    console.error('❌ Error: No DATABASE_URI or MONGODB_URI found in environment variables')
    process.exit(1)
  }

  console.log('🔗 Connecting to MongoDB...')
  console.log(`📍 Database: ${dbName}`)
  console.log(`🔗 URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`) // Hide credentials
  
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    const db = client.db(dbName)
    
    // List all collections
    console.log('\n📋 Collections in database:')
    const collections = await db.listCollections().toArray()
    console.log(`Total collections: ${collections.length}`)
    
    for (const collection of collections) {
      console.log(`  - ${collection.name}`)
    }
    
    // Check specific collections we care about
    const collectionsToCheck = ['trips', 'activities', 'media', 'users']
    
    console.log('\n📊 Document counts:')
    for (const collectionName of collectionsToCheck) {
      try {
        const count = await db.collection(collectionName).countDocuments()
        console.log(`  ${collectionName}: ${count} documents`)
        
        if (count > 0 && (collectionName === 'activities' || collectionName === 'trips')) {
          // Show sample document
          const sample = await db.collection(collectionName).findOne()
          console.log(`    Sample ${collectionName} document:`)
          console.log(`    ID: ${sample._id}`)
          if (sample.title) console.log(`    Title: ${sample.title}`)
          if (sample.trip) console.log(`    Trip: ${sample.trip} (type: ${typeof sample.trip})`)
          if (sample.slug) console.log(`    Slug: ${sample.slug}`)
        }
      } catch (error) {
        console.log(`  ${collectionName}: Error - ${error.message}`)
      }
    }
    
    // If there are activities, check the trip field types
    const activitiesCount = await db.collection('activities').countDocuments()
    if (activitiesCount > 0) {
      console.log('\n🔍 Trip field analysis:')
      const stringTrips = await db.collection('activities').countDocuments({ trip: { $type: "string" } })
      const objectIdTrips = await db.collection('activities').countDocuments({ trip: { $type: "objectId" } })
      console.log(`  String trip references: ${stringTrips}`)
      console.log(`  ObjectId trip references: ${objectIdTrips}`)
      
      if (stringTrips > 0) {
        console.log('\n  Sample activities with string trip references:')
        const samples = await db.collection('activities').find({ trip: { $type: "string" } }).limit(3).toArray()
        for (const activity of samples) {
          console.log(`    ${activity._id}: "${activity.title}" -> trip: "${activity.trip}"`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\n🔌 Database connection closed')
  }
}

// Run the script
if (require.main === module) {
  console.log('🔍 Database Diagnostic Script')
  console.log('=' .repeat(50))
  
  checkDatabase()
    .then(() => {
      console.log('\n✨ Diagnostic completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Diagnostic failed:', error.message)
      process.exit(1)
    })
} 