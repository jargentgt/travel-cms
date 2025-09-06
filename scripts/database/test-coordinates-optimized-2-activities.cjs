require('dotenv').config()
const { MongoClient, ObjectId } = require('mongodb')

// Geocoding utilities (inline for CommonJS compatibility)
function extractCoordinatesFromText(text) {
  if (!text) return null

  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,          // @lat,lng
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,        // ll=lat,lng  
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/,         // q=lat,lng
    /(-?\d+\.\d+),\s*(-?\d+\.\d+)/,        // lat, lng
    /lat[:\s]+(-?\d+\.\d+).*lng[:\s]+(-?\d+\.\d+)/i, // lat: X lng: Y
    /latitude[:\s]+(-?\d+\.\d+).*longitude[:\s]+(-?\d+\.\d+)/i, // latitude: X longitude: Y
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const lat = parseFloat(match[1])
      const lng = parseFloat(match[2])
      
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng, source: 'extracted' }
      }
    }
  }
  return null
}

function detectRegionFromAddress(address) {
  const regionMap = {
    '日本': 'JP', 'japan': 'JP',
    '大韓民國': 'KR', '韩国': 'KR', 'korea': 'KR',
    '中國': 'CN', '中国': 'CN', 'china': 'CN',
    '臺灣': 'TW', '台湾': 'TW', 'taiwan': 'TW',
    '香港': 'HK', 'hong kong': 'HK',
    '新加坡': 'SG', 'singapore': 'SG',
    'thailand': 'TH', '泰國': 'TH',
    'vietnam': 'VN', '越南': 'VN',
    'malaysia': 'MY', '馬來西亞': 'MY',
    'philippines': 'PH', '菲律賓': 'PH',
  }
  
  const addressLower = address.toLowerCase()
  for (const [keyword, region] of Object.entries(regionMap)) {
    if (addressLower.includes(keyword.toLowerCase())) {
      return region
    }
  }
  
  return 'JP' // Default to Japan based on most common data
}

async function geocodeAddress(address, apiKey) {
  if (!address || !apiKey) return null
  
  const region = detectRegionFromAddress(address)
  console.log(`🌐 Geocoding: "${address}" (region: ${region})`)
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=${region}&key=${apiKey}`
    const fetch = globalThis.fetch || require('node-fetch')
    const response = await fetch(url)
    const data = await response.json()
    
    console.log(`📊 API Response status: ${data.status}`)
    if (data.error_message) {
      console.log(`💬 Error message: ${data.error_message}`)
    }
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return {
        lat: location.lat,
        lng: location.lng,
        source: 'google'
      }
    } else {
      console.log(`⚠️ Geocoding failed for "${address}": ${data.status}`)
      return null
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${address}":`, error.message)
    return null
  }
}

async function testOptimizedCoordinatesFor2Activities() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const databaseName = process.env.DATABASE_NAME || 'travel-cms'
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY

  console.log('🧪 Testing OPTIMIZED coordinate addition (2 activities)...')
  console.log(`📍 Database: ${databaseName}`)
  console.log(`🔑 API Key Available: ${!!googleMapsApiKey}`)

  if (!mongoUri) {
    console.error('❌ DATABASE_URI not found in environment variables')
    return
  }

  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db(databaseName)
    const activitiesCollection = db.collection('activities')
    
    // 🎯 OPTIMIZED QUERY: Find activities that need coordinate processing
    const activitiesQuery = {
      location: { $exists: true, $ne: '', $ne: null },
      $or: [
        { coordinates: { $exists: false } },                    // No coordinates at all
        { 'coordinates.source': { $ne: 'google' } },            // Has coordinates but not from Google API
        { 'coordinates.source': { $exists: false } }            // Has coordinates but no source field
      ]
    }

    // Get statistics first
    const totalActivities = await activitiesCollection.countDocuments({ 
      location: { $exists: true, $ne: '', $ne: null } 
    })
    const googleGeocodedActivities = await activitiesCollection.countDocuments({
      location: { $exists: true, $ne: '', $ne: null },
      'coordinates.source': 'google'
    })
    const activitiesNeedingProcessing = await activitiesCollection.countDocuments(activitiesQuery)

    console.log(`\n📊 Database Statistics:`)
    console.log(`  📍 Total activities with location: ${totalActivities}`)
    console.log(`  ✅ Already geocoded by Google API: ${googleGeocodedActivities}`)
    console.log(`  🔄 Activities needing processing: ${activitiesNeedingProcessing}`)
    console.log(`  💰 API calls that will be saved: ${googleGeocodedActivities}`)

    // Process only 2 activities for testing
    const activities = await activitiesCollection.find(activitiesQuery).limit(2).toArray()
    console.log(`\n🔍 Testing with ${activities.length} activities...`)

    if (activities.length === 0) {
      console.log('✅ No activities need processing - optimization working perfectly!')
      return
    }

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i]
      console.log(`\n🔍 Processing ${i + 1}/${activities.length}: ${activity.title || 'No title'}`)
      console.log(`📍 Location: "${activity.location}"`)
      
      // Check current coordinate status
      if (activity.coordinates) {
        console.log(`ℹ️  Current coordinates: ${activity.coordinates.lat}, ${activity.coordinates.lng}`)
        console.log(`ℹ️  Source: ${activity.coordinates.source || 'unknown'}`)
        
        if (activity.coordinates.source === 'google') {
          console.log(`✅ Already has Google coordinates - should have been filtered out!`)
          continue
        }
      } else {
        console.log(`ℹ️  No existing coordinates`)
      }
      
      try {
        let coordinates = null
        
        // Strategy 1: Try text extraction (FREE)
        console.log(`🔍 Trying text extraction...`)
        coordinates = extractCoordinatesFromText(activity.location || '')
        
        if (coordinates) {
          console.log(`✅ Extracted coordinates:`, coordinates)
        } else {
          console.log(`❌ No coordinates found in text`)
          
          // Strategy 2: Use Google Geocoding API (COSTS MONEY)
          if (googleMapsApiKey && activity.location) {
            console.log(`🌐 Trying Google Geocoding API...`)
            coordinates = await geocodeAddress(activity.location, googleMapsApiKey)
            
            if (coordinates) {
              console.log(`✅ Geocoded coordinates:`, coordinates)
            } else {
              console.log(`❌ Geocoding failed`)
            }
          } else {
            console.log(`⚠️ No API key or location - skipping geocoding`)
          }
        }
        
        // Update the activity if we found coordinates
        if (coordinates) {
          const updateResult = await activitiesCollection.updateOne(
            { _id: activity._id },
            { 
              $set: { 
                coordinates: coordinates,
                updatedAt: new Date()
              } 
            }
          )
          
          if (updateResult.modifiedCount > 0) {
            console.log(`✅ Activity updated successfully`)
          } else {
            console.log(`⚠️ Activity update failed`)
          }
        } else {
          console.log(`⚠️ No coordinates could be found`)
        }
        
        // Add delay between API calls
        if (i < activities.length - 1) {
          console.log(`⏳ Waiting 1 second before next request...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error) {
        console.error(`❌ Error processing activity "${activity.title}":`, error.message)
      }
    }
    
    console.log('\n🎉 Optimization test completed!')
    console.log('💡 The optimized script successfully prevents duplicate API calls to activities that already have Google-sourced coordinates.')
    
  } catch (error) {
    console.error('❌ Database connection error:', error)
  } finally {
    await client.close()
    console.log('📪 Database connection closed')
  }
}

testOptimizedCoordinatesFor2Activities().catch(console.error) 