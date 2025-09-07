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

function extractCoordinatesFromGoogleMapsUrl(url) {
  if (!url || typeof url !== 'string') return null

  // Handle Google Maps share URLs
  const shareUrlPattern = /maps\.app\.goo\.gl\/[a-zA-Z0-9]+/
  if (shareUrlPattern.test(url)) {
    console.log(`📍 Found Google Maps share URL: ${url} - would need to resolve this`)
    // Note: Share URLs need to be resolved, which requires an HTTP request
    return null
  }

  // Handle direct coordinate patterns in URLs
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),(-?\d+\.\d+)/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
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
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return {
        lat: location.lat,
        lng: location.lng,
        source: 'google'
      }
    } else {
      console.log(`⚠️ Geocoding failed for "${address}": ${data.status}`)
      if (data.error_message) {
        console.log(`💬 Error message: ${data.error_message}`)
      }
      return null
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${address}":`, error.message)
    return null
  }
}

async function addCoordinatesToActivitiesOptimized() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const databaseName = process.env.DATABASE_NAME || 'travel-cms'
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY

  console.log('🚀 Starting optimized coordinate addition (prevents duplicate API calls)...')
  console.log(`📍 Database: ${databaseName}`)
  console.log(`🔑 Google Maps API Key: ${googleMapsApiKey ? 'Available' : 'Not Available'}`)

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
    // Skip activities that already have Google-sourced coordinates (prevents duplicate API calls)
    const activitiesQuery = {
      location: { $exists: true, $ne: '', $ne: null },
      $or: [
        { latitude: { $exists: false } },                       // No coordinates at all
        { longitude: { $exists: false } },                      // No coordinates at all
        { coordinatesSource: { $ne: 'google' } },               // Has coordinates but not from Google API
        { coordinatesSource: { $exists: false } },              // Has coordinates but no source field
        // Also include old coordinate structure for migration
        { coordinates: { $exists: true }, latitude: { $exists: false } }  // Has old coordinates but not new ones
      ]
    }

    // Get statistics before processing
    const totalActivities = await activitiesCollection.countDocuments({ 
      location: { $exists: true, $ne: '', $ne: null } 
    })
    const googleGeocodedActivities = await activitiesCollection.countDocuments({
      location: { $exists: true, $ne: '', $ne: null },
      coordinatesSource: 'google',
      latitude: { $exists: true },
      longitude: { $exists: true }
    })
    const activitiesNeedingProcessing = await activitiesCollection.countDocuments(activitiesQuery)

    console.log(`\n📊 Activity Statistics:`)
    console.log(`  📍 Total activities with location: ${totalActivities}`)
    console.log(`  ✅ Already geocoded by Google API: ${googleGeocodedActivities}`)
    console.log(`  🔄 Needing processing: ${activitiesNeedingProcessing}`)
    console.log(`  💰 API calls saved: ${googleGeocodedActivities}`)

    const activities = await activitiesCollection.find(activitiesQuery).toArray()
    console.log(`\n🔍 Processing ${activities.length} activities...`)

    if (activities.length === 0) {
      console.log('✅ All activities already have coordinates or are optimally geocoded!')
      return
    }

    let updatedCount = 0
    let extractedCount = 0
    let geocodedCount = 0
    let skippedCount = 0
    let alreadyGoogleGeocodedCount = 0
    let invalidLocationCount = 0
    let apiCallCount = 0

    // Estimate costs only for activities that will actually call the API
    const needsGeocodingCount = activities.filter(a => 
      !extractCoordinatesFromText(a.location || '') && a.location
    ).length
    
    console.log(`💰 Estimated geocoding cost: $${((needsGeocodingCount * 5) / 1000).toFixed(3)} (${needsGeocodingCount} API calls)`)
    console.log(`💡 This one-time cost saves money long-term by reducing frontend API calls\n`)

    for (const activity of activities) {
      try {
        console.log(`🔍 Processing: ${activity.title}`)
        console.log(`📍 Location: "${activity.location}"`)

        if (!activity.location || activity.location === '' || activity.location === null) {
          console.log(`✅ Location not exist, skipping...`)
          invalidLocationCount++
          continue
        }
        
        // Check if this activity already has Google-sourced coordinates
        if (activity.coordinatesSource === 'google' && activity.latitude && activity.longitude) {
          console.log(`✅ Already has Google coordinates, skipping...`)
          alreadyGoogleGeocodedCount++
          continue
        }
        
        // Check if this activity already has any coordinates
        if (activity.latitude && activity.longitude) {
          console.log(`ℹ️  Has coordinates from source: ${activity.coordinatesSource || 'unknown'}`)
          console.log(`📍 Existing coordinates: ${activity.latitude}, ${activity.longitude}`)
          
          // You could choose to skip these entirely or try to improve them with Google geocoding
          // For cost optimization, let's skip activities that already have any valid coordinates
          console.log(`✅ Skipping - already has coordinates`)
          skippedCount++
          continue
        }

        
        
        let coordinates = null

        // Strategy 1: Try to extract coordinates from location field only (FREE)
        coordinates = extractCoordinatesFromText(activity.location || '')
        
        if (coordinates) {
          console.log(`📍 Extracted coordinates from location: ${coordinates.lat}, ${coordinates.lng}`)
          extractedCount++
        }

        // Strategy 2: Use Google Geocoding API if available (COSTS MONEY)
        if (!coordinates && googleMapsApiKey && activity.location) {
          coordinates = await geocodeAddress(activity.location, googleMapsApiKey)
          if (coordinates) {
            console.log(`🌐 Geocoded address: ${coordinates.lat}, ${coordinates.lng}`)
            geocodedCount++
            apiCallCount++
            
            // Add small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        // Update activity if coordinates were found
        if (coordinates) {
          const updateResult = await activitiesCollection.updateOne(
            { _id: activity._id },
            { 
              $set: { 
                latitude: coordinates.lat,
                longitude: coordinates.lng,
                coordinatesSource: coordinates.source,
                updatedAt: new Date()
              },
              // Remove old coordinates field if it exists
              $unset: {
                coordinates: ""
              }
            }
          )
          
          if (updateResult.modifiedCount > 0) {
            updatedCount++
            console.log(`✅ Updated successfully`)
          } else {
            console.log(`⚠️ Update failed`)
          }
        } else {
          console.log(`⚠️ No coordinates found for "${activity.location}"`)
          skippedCount++
        }
        
      } catch (error) {
        console.error(`❌ Error processing activity "${activity.title}":`, error.message)
        skippedCount++
      }
    }

    // Final statistics
    console.log('\n🎉 Coordinate addition completed!')
    console.log('📈 Statistics:')
    console.log(`  - Total activities processed: ${activities.length}`)
    console.log(`  - Activities updated: ${updatedCount}`)
    console.log(`  - Coordinates extracted from text: ${extractedCount}`)
    console.log(`  - Coordinates geocoded via API: ${geocodedCount}`)
    console.log(`  - Already had Google coordinates: ${alreadyGoogleGeocodedCount}`)
    console.log(`  - Skipped (no coordinates found): ${skippedCount}`)
    console.log(`  - Invalid location: ${invalidLocationCount}`)
    console.log(`  - Google API calls made: ${apiCallCount}`)
    console.log(`  - API calls prevented: ${googleGeocodedActivities}`)
    console.log(`💰 Total cost: $${((apiCallCount * 5) / 1000).toFixed(3)}`)
    
  } catch (error) {
    console.error('❌ Database connection error:', error)
  } finally {
    await client.close()
    console.log('📪 Database connection closed')
  }
}

addCoordinatesToActivitiesOptimized().catch(console.error) 