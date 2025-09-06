require('dotenv').config()
const { MongoClient, ObjectId } = require('mongodb')
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

// Import geocoding utilities (converted to CommonJS)
const { extractCoordinatesFromText, getActivityCoordinates, detectRegionFromAddress } = (() => {
  // Inline implementation of geocoding utilities for CommonJS compatibility
  
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
    if (!address) return undefined
    
    const addressLower = address.toLowerCase()
    if (addressLower.includes('日本') || addressLower.includes('japan')) return 'JP'
    if (addressLower.includes('korea') || addressLower.includes('한국') || addressLower.includes('대한민국')) return 'KR'
    if (addressLower.includes('taiwan') || addressLower.includes('台灣') || addressLower.includes('台湾')) return 'TW'
    
    return 'JP' // Default
  }

  async function getActivityCoordinates(location, description = '') {
    const textToSearch = `${description} ${location}`.toLowerCase()
    const extracted = extractCoordinatesFromText(textToSearch)
    if (extracted) {
      console.log(`📍 [IMPORT] Extracted coordinates for "${location}":`, extracted)
      return extracted
    }
    
    console.log(`⚠️ [IMPORT] No coordinates found for "${location}" (geocoding API not configured)`)
    return null
  }

  return { extractCoordinatesFromText, getActivityCoordinates, detectRegionFromAddress }
})()

// Icon mapping for different activity types
const ICON_MAP = {
  '飛': '✈️', '早餐': '🍳', '午餐': '🍽️', '晚餐': '🍽️', '宵夜': '🌃',
  '租車': '🚗', '車': '🚗', '越野': '🏎️',
  '酒店': '🏨', '入住': '🏨', '退房': '🏨',
  '購物': '🛍️', '市場': '🛍️',
  '拍照': '📸', '景點': '🏛️',
  '汗蒸幕': '🧘', '樂園': '🎢', '騎行': '🚴', '漫步': '🚶',
  '博物館': '🏛️', '滑翔傘': '🪂', '公園': '🌳', '騎馬': '🐎',
  '潛水艇': '🚢', '瀑布': '🏞️', '韓服': '👘', '船': '⛵',
  '快艇': '🚤', '海女': '🤿', '獨木舟': '🛶', '咖啡': '☕',
  'EggDrop': '🍳', '炸豬排': '🍽️', '橘子': '🍊', '鰻魚': '🐟',
  '風車': '🌪️', '海岸': '🏖️', '熔岩': '🌋', '電動自行車': '🚴',
  '翰林': '🌳', 'Tribe': '🍊', 'Handammol': '🌊', 'Sinchang': '🌪️'
}

// Category mapping
const CATEGORY_MAP = {
  '飛': 'airport', '早餐': 'restaurant', '午餐': 'restaurant', '晚餐': 'restaurant', '宵夜': 'restaurant',
  '租車': 'driving', '車': 'transport', '越野': 'driving',
  '酒店': 'hotel', '入住': 'hotel', '退房': 'hotel',
  '購物': 'shopping', '市場': 'shopping',
  '拍照': 'activity', '景點': 'activity', '博物館': 'activity',
  '汗蒸幕': 'activity', '樂園': 'activity', '騎行': 'activity', '漫步': 'activity',
  '滑翔傘': 'activity', '公園': 'activity', '騎馬': 'activity',
  '潛水艇': 'activity', '瀑布': 'activity', '韓服': 'activity', '船': 'transport',
  '快艇': 'transport', '海女': 'activity', '獨木舟': 'activity',
  'EggDrop': 'cafe', '炸豬排': 'restaurant', '橘子': 'cafe', '鰻魚': 'restaurant',
  '咖啡': 'cafe', '風車': 'activity', '海岸': 'activity', '熔岩': 'restaurant',
  '翰林': 'activity', 'Tribe': 'cafe', 'Handammol': 'activity'
}

function getIconForActivity(title) {
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (title.includes(keyword)) {
      return icon
    }
  }
  return '📍' // Default icon
}

function getCategoryForActivity(title) {
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (title.includes(keyword)) {
      return category
    }
  }
  return 'activity' // Default category
}

// Enhanced category parsing from description (preserving keywords)
function parseCategoryFromDescription(description) {
  if (!description || typeof description !== 'string') {
    return { category: null, originalDescription: description }
  }

  const categoryPatterns = [
    { regex: /\[([^\]]+)\]/, name: 'square brackets' },
    { regex: /「([^」]+)」/, name: 'Japanese quotes' },
    { regex: /「([^\]]+)\]/, name: 'mixed quotes-bracket' },
    { regex: /\[([^」]+)」/, name: 'mixed bracket-quote' }
  ]

  for (const pattern of categoryPatterns) {
    const match = description.match(pattern.regex)
    if (match) {
      const extractedText = match[1].trim()
      
      // Map common category markers to standardized categories
      const categoryMap = {
        'hotel': 'hotel',
        'accommodation': 'hotel', 
        'lodging': 'hotel',
        'restaurant': 'restaurant',
        'food': 'restaurant',
        'dining': 'restaurant',
        'cafe': 'cafe',
        'coffee': 'cafe',
        'activity': 'activity',
        'sightseeing': 'activity',
        'attraction': 'activity',
        'museum': 'activity',
        'temple': 'activity',
        'park': 'activity',
        'shopping': 'shopping',
        'market': 'shopping',
        'transport': 'transport',
        'transportation': 'transport',
        'airport': 'airport',
        'station': 'transport',
        'driving': 'driving'
      }

      const normalizedCategory = extractedText.toLowerCase()
      const category = categoryMap[normalizedCategory] || extractedText.toLowerCase()

      console.log(`📋 Found category marker [${extractedText}] -> ${category}`)
      
      // Return original description WITHOUT removing the category keyword
      return { category, originalDescription: description }
    }
  }
  
  return { category: null, originalDescription: description }
}

async function parseCSVData(csvData) {
  const activities = []
  
  for (const row of csvData) {
    try {
      const date = row['日期'] || row['date'] || row.Date
      const startTime = row['開始時間'] || row['start_time'] || row.StartTime || ''
      const endTime = row['結束時間'] || row['end_time'] || row.EndTime || ''
      const title = row['活動摘要'] || row['activity'] || row.Activity || row.Title || ''
      const location = row['地點'] || row['location'] || row.Location || ''
      const description = row['描述/備註'] || row['description'] || row.Description || ''
      const source = row['來源日曆'] || row['source'] || row.Source || '旅行'

      if (!date || !title) {
        console.log('Skipping row - missing date or title:', { date, title })
        continue
      }
      
      if (source === 'Rain Plan') {
        console.log('Skipping rain plan activity:', title)
        continue
      }

      const timeRange = startTime && endTime ? `${startTime}-${endTime}` : startTime || '全天'

      // Parse category from description first, then fall back to title-based detection
      const { category: descriptionCategory, originalDescription } = parseCategoryFromDescription(description)
      const finalCategory = descriptionCategory || getCategoryForActivity(title)

      // Generate coordinates for the activity location (COST SAVING!)
      let coordinates = null
      if (location && location.trim()) {
        coordinates = await getActivityCoordinates(location.trim(), originalDescription || '')
      }

      const activity = {
        time: timeRange,
        title: title,
        location: location || '',
        description: originalDescription || '', // Keep original description with category keywords
        category: finalCategory,
        icon: getIconForActivity(title),
        type: 'normal',
        coordinates: coordinates // Add pre-calculated coordinates
      }

      activities.push({ date, activity })
    } catch (error) {
      console.warn('Error parsing CSV row:', error, row)
    }
  }

  return activities
}

async function reImportActivities() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  
  if (!mongoUri) {
    console.error('❌ DATABASE_URI not found in environment variables')
    return
  }

  console.log('🚀 Starting re-import process for 2025 Jeju and Osaka trips...')

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const db = client.db('travel-cms') // Use the specific database name
    const tripsCollection = db.collection('trips')
    const activitiesCollection = db.collection('activities')

    // CSV files to import (without "imported" in filename)
    const csvFilesToImport = [
      {
        fileName: '68b474b171c114485c247b4b.csv',
        tripId: '68b474b171c114485c247b4b',
        tripName: 'Jeju 2025'
      },
      {
        fileName: '68b4748f9c1e2c2f21f4694e.csv', 
        tripId: '68b4748f9c1e2c2f21f4694e',
        tripName: 'Osaka 2025'
      }
    ]

    for (const csvFile of csvFilesToImport) {
      console.log(`\n🗂️  Processing ${csvFile.tripName} (${csvFile.fileName})...`)
      
      // Verify trip exists
      let trip
      try {
        trip = await tripsCollection.findOne({ _id: new ObjectId(csvFile.tripId) })
        if (!trip) {
          console.error(`❌ Trip not found: ${csvFile.tripId}`)
          continue
        }
        console.log(`✅ Found trip: ${trip.title}`)
      } catch (error) {
        console.error(`❌ Error finding trip ${csvFile.tripId}:`, error.message)
        continue
      }

      // Read CSV file
      const csvPath = path.join(__dirname, '../../assets/import-activity', csvFile.fileName)
      if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`)
        continue
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8')
      const csvData = Papa.parse(csvContent, { header: true }).data
      console.log(`📊 Parsed ${csvData.length} rows from CSV`)

      // Parse activities from CSV with coordinate generation
      console.log(`🔄 Parsing activities and generating coordinates...`)
      const parsedActivities = await parseCSVData(csvData)
      console.log(`✅ Successfully parsed ${parsedActivities.length} activities with coordinates`)

      if (parsedActivities.length === 0) {
        console.log('⚠️ No valid activities found in CSV')
        continue
      }

      // Remove existing activities for this trip
      console.log(`🗑️  Removing existing activities for trip: ${trip.title}`)
      const deleteResult = await activitiesCollection.deleteMany({ 
        trip: new ObjectId(csvFile.tripId) 
      })
      console.log(`✅ Removed ${deleteResult.deletedCount} existing activities`)

      // Import new activities
      let createdCount = 0
      const dayGroups = {}
      const errors = []

      for (const { date, activity } of parsedActivities) {
        try {
          const activityData = {
            ...activity,
            date: new Date(date),
            trip: new ObjectId(csvFile.tripId),
            order: createdCount,
            status: 'published',
            createdAt: new Date(),
            updatedAt: new Date()
          }

          const result = await activitiesCollection.insertOne(activityData)

          // Group activities by date for trip days
          const dateKey = new Date(date).toISOString().split('T')[0]
          if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = []
          }
          dayGroups[dateKey].push(result.insertedId)

          createdCount++
          console.log(`✅ Created activity: ${activity.title} (${dateKey})`)
        } catch (error) {
          const errorMsg = `Error creating activity "${activity.title}": ${error.message}`
          console.error('❌', errorMsg)
          errors.push(errorMsg)
        }
      }

      // Update trip with organized days
      const tripDays = Object.entries(dayGroups).map(([dateKey, activityIds]) => ({
        date: new Date(dateKey),
        activities: activityIds
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      await tripsCollection.updateOne(
        { _id: new ObjectId(csvFile.tripId) },
        { 
          $set: { 
            days: tripDays,
            updatedAt: new Date()
          } 
        }
      )

      console.log(`🎉 Import completed for ${csvFile.tripName}!`)
      console.log(`📈 Statistics:`)
      console.log(`  - Activities created: ${createdCount}`)
      console.log(`  - Days: ${tripDays.length}`)
      console.log(`  - Errors: ${errors.length}`)

      if (errors.length > 0) {
        console.log(`⚠️ Errors encountered:`)
        errors.forEach(error => console.log(`  - ${error}`))
      }
    }

    console.log(`\n✅ All imports completed successfully!`)

  } catch (error) {
    console.error('❌ Import failed:', error)
  } finally {
    await client.close()
  }
}

// Run the import
reImportActivities().catch(console.error) 