#!/usr/bin/env node
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

async function checkRawTrips() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    const db = client.db('travel-cms')
    const trips = await db.collection('trips').find({}).toArray()
    
    console.log('Raw trips from MongoDB:')
    trips.forEach(trip => {
      console.log(`- ${trip.title} (${trip.slug}) - Status: ${trip.status || 'NOT SET'}`)
    })
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.close()
  }
}

checkRawTrips()
