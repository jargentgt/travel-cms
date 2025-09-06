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
  if (!address) return undefined
  
  const addressLower = address.toLowerCase()
  if (addressLower.includes('日本') || addressLower.includes('japan')) return 'JP'
  if (addressLower.includes('korea') || addressLower.includes('한국') || addressLower.includes('대한민국')) return 'KR'
  if (addressLower.includes('taiwan') || addressLower.includes('台灣') || addressLower.includes('台湾')) return 'TW'
  if (addressLower.includes('china') || addressLower.includes('中国') || addressLower.includes('中國')) return 'CN'
  
  return 'JP' // Default
}

// Google Maps Geocoding API function
async function geocodeAddress(address, apiKey) {
  if (!address || !apiKey) return null

  const region = detectRegionFromAddress(address)
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=${region}&key=${apiKey}`

  try {
    console.log(`🌐 Geocoding: "${address}" (region: ${region})`)
    
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.results?.[0]) {
      const location = data.results[0].geometry.location
      return {
        lat: location.lat,
        lng: location.lng,
        source: 'google'
      }
    } else {
      console.warn(`⚠️ Geocoding failed for "${address}": ${data.status}`)
      return null
    }
  } catch (error) {
    console.error(`❌ Geocoding error for "${address}":`, error.message)
    return null
  }
}

async function addCoordinatesToActivitiesWithGeocoding() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY
  
  if (!mongoUri) {
    console.error('❌ DATABASE_URI not found in environment variables')
    return
  }

  console.log('🚀 Adding coordinates to existing activities...')
  if (googleMapsApiKey) {
    console.log('🌐 Google Maps API key found - geocoding enabled')
  } else {
    console.log('⚠️ No Google Maps API key - only text extraction will be used')
  }

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const db = client.db('travel-cms')
    const activitiesCollection = db.collection('activities')

    // Find all activities without coordinates that have location data
    const activitiesQuery = {
      location: { $exists: true, $ne: '', $ne: null },
      coordinates: { $exists: false }
    }

    const activities = await activitiesCollection.find(activitiesQuery).toArray()
    console.log(`📊 Found ${activities.length} activities without coordinates`)

    if (activities.length === 0) {
      console.log('✅ All activities already have coordinates or no location data')
      return
    }

    let updatedCount = 0
    let extractedCount = 0
    let geocodedCount = 0
    let skippedCount = 0
    let apiCallCount = 0

    console.log(`💰 Estimated geocoding cost: $${((activities.length * 5) / 1000).toFixed(3)}`)
    console.log(`💡 This one-time cost will save money long-term by reducing frontend API calls\n`)

    for (const activity of activities) {
      try {
        console.log(`🔍 Processing: ${activity.title}`)
        
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
                coordinates: coordinates,
                updatedAt: new Date()
              } 
            }
          )
          
          if (updateResult.modifiedCount > 0) {
            console.log(`✅ Added coordinates to "${activity.title}": ${coordinates.lat}, ${coordinates.lng} (source: ${coordinates.source})`)
            updatedCount++
          }
        } else {
          console.log(`⚠️ No coordinates found for "${activity.title}" (location: "${activity.location}")`)
          skippedCount++
        }

      } catch (error) {
        console.error(`❌ Error processing activity "${activity.title}":`, error.message)
        skippedCount++
      }
    }

    console.log(`\n🎉 Coordinate addition completed!`)
    console.log(`📈 Statistics:`)
    console.log(`  - Total activities processed: ${activities.length}`)
    console.log(`  - Activities updated: ${updatedCount}`)
    console.log(`  - Coordinates extracted from text: ${extractedCount}`)
    console.log(`  - Coordinates geocoded via API: ${geocodedCount}`)
    console.log(`  - Skipped (no coordinates found): ${skippedCount}`)
    
    if (apiCallCount > 0) {
      console.log(`\n💰 API Usage:`)
      console.log(`  - Geocoding API calls made: ${apiCallCount}`)
      console.log(`  - Estimated cost: $${((apiCallCount * 5) / 1000).toFixed(3)}`)
      console.log(`  - Future savings per 1000 map views: $${((updatedCount * 5) / 1000).toFixed(3)}`)
    }

  } catch (error) {
    console.error('❌ Failed to add coordinates:', error)
  } finally {
    await client.close()
  }
}

// Run the enhanced coordinate addition
addCoordinatesToActivitiesWithGeocoding().catch(console.error) 