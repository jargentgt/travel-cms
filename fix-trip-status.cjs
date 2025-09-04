#!/usr/bin/env node
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

async function fixTripStatus() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    const db = client.db('travel-cms')
    
    // Update trips without status to published
    const result = await db.collection('trips').updateMany(
      { status: { $exists: false } },
      { $set: { status: 'published', updatedAt: new Date() } }
    )
    
    console.log(`✅ Updated ${result.modifiedCount} trips to published status`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.close()
  }
}

fixTripStatus()
