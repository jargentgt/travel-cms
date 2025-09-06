#!/usr/bin/env node
const { MongoClient, ObjectId } = require('mongodb')
const path = require('path')
const fs = require('fs')
const Papa = require('papaparse')

// Import geocoding utilities (converted to CommonJS)
const { extractCoordinatesFromText, getActivityCoordinates, detectRegionFromAddress } = (() => {
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

  return { extractCoordinatesFromText, getActivityCoordinates }
})()
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

// Icon mapping for different activity types
const ICON_MAP = {
  '飛': '✈️', '早餐': '🍳', '午餐': '🍽️', '晚餐': '🍽️', '宵夜': '🌃',
  '租車': '🚗', '車': '🚗', '越野': '🏎️',
  '酒店': '🏨', '入住': '🏨', '退房': '🏨',
  '購物': '🛍️', '市場': '🛍️',
  '拍照': '📸', '景點': '🏛️', '台北': '🏙️', '東京': '🏙️',
  '汗蒸幕': '🧘', '樂園': '🎢', '騎行': '🚴', '漫步': '🚶',
  '博物館': '🏛️', '滑翔傘': '🪂', '公園': '🌳', '騎馬': '🐎',
  '潛水艇': '🚢', '瀑布': '🏞️', '韓服': '👘', '船': '⛵',
  '快艇': '🚤', '海女': '🤿', '獨木舟': '🛶', '咖啡': '☕',
  '溫泉': '♨️', '神社': '⛩️', '塔': '🗼', '電車': '🚇'
}

// Category mapping
const CATEGORY_MAP = {
  '飛': 'airport', '早餐': 'restaurant', '午餐': 'restaurant', '晚餐': 'restaurant', '宵夜': 'restaurant',
  '租車': 'driving', '車': 'transport', '越野': 'driving', '電車': 'transport',
  '酒店': 'hotel', '入住': 'hotel', '退房': 'hotel',
  '購物': 'shopping', '市場': 'shopping',
  '拍照': 'activity', '景點': 'activity', '博物館': 'activity', '神社': 'activity',
  '汗蒸幕': 'activity', '樂園': 'activity', '騎行': 'activity', '漫步': 'activity',
  '滑翔傘': 'activity', '公園': 'activity', '騎馬': 'activity', '溫泉': 'activity',
  '潛水艇': 'activity', '瀑布': 'activity', '韓服': 'activity', '船': 'transport',
  '快艇': 'transport', '海女': 'activity', '獨木舟': 'activity',
  '咖啡': 'cafe', '塔': 'activity'
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

function parseCategoryFromDescription(description) {
  if (!description) return { category: null, cleanDescription: description }
  
  // Handle descriptions that might start with newlines - check first few non-empty lines
  const lines = description.split('\n')
  let targetLine = ''
  let targetLineIndex = -1
  
  // Find the first non-empty line (that might contain the marker)
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i].trim()
    if (line) {
      targetLine = line
      targetLineIndex = i
      break
    }
  }
  
  if (!targetLine) return { category: null, cleanDescription: description }
  
  // More flexible patterns - don't require start of line, handle whitespace
  const categoryPatterns = [
    /\[([^\]]+)\]/,  // [{category}]
    /「([^\]]+)\]/,  // 「{category}]
    /「([^」]+)」/,  // 「{category}」
    /\[([^」]+)」/,   // [{category}」
    /【([^】]+)】/,  // 【{category}】
  ]
  
  for (const pattern of categoryPatterns) {
    const match = targetLine.match(pattern)
    if (match) {
      const categoryText = match[1].trim()
      
      // Map category text to actual category
      const categoryMapping = {
        'restaurant': 'restaurant',
        '餐廳': 'restaurant',
        '早餐': 'restaurant',
        '午餐': 'restaurant', 
        '晚餐': 'restaurant',
        '宵夜': 'restaurant',
        '食': 'restaurant',
        
        'hotel': 'hotel',
        '酒店': 'hotel',
        '住宿': 'hotel',
        '入住': 'hotel',
        '退房': 'hotel',
        
        'transport': 'transport',
        '交通': 'transport',
        '車': 'transport',
        '電車': 'transport',
        '船': 'transport',
        '快艇': 'transport',
        '機場': 'airport',
        'airport': 'airport',
        '飛機': 'airport',
        '飛': 'airport',
        
        'shopping': 'shopping',
        '購物': 'shopping',
        '市場': 'shopping',
        '買': 'shopping',
        
        'activity': 'activity',
        '活動': 'activity',
        '景點': 'activity',
        '拍照': 'activity',
        '博物館': 'activity',
        '神社': 'activity',
        '樂園': 'activity',
        '公園': 'activity',
        '溫泉': 'activity',
        '潛水': 'activity',
        
        'cafe': 'cafe',
        '咖啡': 'cafe',
        '茶': 'cafe',
        
        'driving': 'driving',
        '租車': 'driving',
        '越野': 'driving',
        '騎行': 'driving'
      }
      
      const category = categoryMapping[categoryText.toLowerCase()] || 'activity'
      
      // Remove the marker from the target line
      const cleanTargetLine = targetLine.replace(match[0], '').trim()
      
      // Rebuild the description
      let cleanDescription
      if (cleanTargetLine === '') {
        // Remove the entire line containing the marker
        const newLines = [...lines]
        newLines.splice(targetLineIndex, 1)
        cleanDescription = newLines.join('\n').trim()
      } else {
        // Replace the line with the cleaned version
        const newLines = [...lines]
        newLines[targetLineIndex] = cleanTargetLine
        cleanDescription = newLines.join('\n').trim()
      }
      
      return { category, cleanDescription: cleanDescription || description }
    }
  }
  
  return { category: null, cleanDescription: description }
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
      const { category: descriptionCategory, cleanDescription } = parseCategoryFromDescription(description)
      const finalCategory = descriptionCategory || getCategoryForActivity(title)

      // Generate coordinates for the activity location (COST SAVING!)
      let coordinates = null
      if (location && location.trim()) {
        coordinates = await getActivityCoordinates(location.trim(), cleanDescription || '')
      }

      const activity = {
        time: timeRange,
        title: title,
        location: location || '',
        description: cleanDescription || '',
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

async function importNewTrips() {
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

    // Import trips data
    const tripsToImport = [
      {
        title: '2023 Tokyo',
        slug: '2023-tokyo',
        location: 'Tokyo',
        country: 'Japan',
        startDate: new Date('2023-01-01T00:00:00.000Z'), // Will be updated from CSV
        endDate: new Date('2023-01-10T00:00:00.000Z'),   // Will be updated from CSV
        csvFile: '2023 Tokyo.csv',
        tags: ['japan', 'tokyo', 'city', 'culture', 'food', 'travel']
      },
      {
        title: '2023 Bangkok',
        slug: '2023-bangkok',
        location: 'Bangkok',
        country: 'Thailand',
        startDate: new Date('2023-01-01T00:00:00.000Z'), // Will be updated from CSV
        endDate: new Date('2023-01-10T00:00:00.000Z'),   // Will be updated from CSV
        csvFile: '2023 Bangkok.csv',
        tags: ['thailand', 'bangkok', 'city', 'food', 'culture', 'temples']
      }
    ]

    for (const tripData of tripsToImport) {
      console.log(`\n🚀 Importing ${tripData.title}...`)
      
      // Check if trip already exists
      const existingTrip = await tripsCollection.findOne({ slug: tripData.slug })
      if (existingTrip) {
        console.log(`⚠️ Trip ${tripData.title} already exists. Skipping creation.`)
        continue
      }

      // Create trip
      const newTrip = {
        title: tripData.title,
        slug: tripData.slug,
        location: tripData.location,
        country: tripData.country,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        tags: tripData.tags,
        days: [],
        status: 'published', // Required for frontend API visibility
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const tripResult = await tripsCollection.insertOne(newTrip)
      const tripId = tripResult.insertedId
      console.log(`✅ Created trip: ${tripData.title} (${tripId})`)

      // Read and parse CSV file
      const csvPath = path.join(__dirname, '../../assets/import-trip', tripData.csvFile)
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

      // Prepare all activities with trip reference (following the proven pattern)
      const allActivities = []
      const dayGroups = {}
      let orderIndex = 0

      for (const { date, activity } of parsedActivities) {
        try {
          const dateKey = new Date(date).toISOString().split('T')[0]
          
          if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = []
          }

          const activityData = {
            ...activity,
            date: new Date(date),
            trip: tripId, // Set trip reference
            order: orderIndex,
            createdAt: new Date(),
            updatedAt: new Date()
          }

          allActivities.push(activityData)
          dayGroups[dateKey].push(orderIndex) // Track position for later ID mapping
          orderIndex++

          console.log(`📝 Prepared activity: ${activity.title} (${dateKey})`)
        } catch (error) {
          console.error(`❌ Error preparing activity "${activity.title}":`, error)
        }
      }

      // Bulk insert all activities (much more efficient)
      if (allActivities.length === 0) {
        console.log('⚠️ No activities to insert')
        continue
      }

      const activityResult = await activitiesCollection.insertMany(allActivities)
      const activityIds = Object.values(activityResult.insertedIds)
      console.log(`✅ Created ${activityIds.length} activities in bulk`)

      // Group activity IDs by date for trip days (following proven pattern)
      const dayActivityIds = {}
      let activityIndex = 0

      const sortedDates = Object.keys(dayGroups).sort()
      for (const dateKey of sortedDates) {
        dayActivityIds[dateKey] = []
        for (let i = 0; i < dayGroups[dateKey].length; i++) {
          dayActivityIds[dateKey].push(activityIds[activityIndex].toString())
          activityIndex++
        }
      }

      // Create days array with activity references
      const tripDays = sortedDates.map((dateKey) => ({
        date: new Date(dateKey),
        activities: dayActivityIds[dateKey]
      }))

      // Update trip with days
      await tripsCollection.updateOne(
        { _id: tripId },
        { 
          $set: { 
            days: tripDays,
            updatedAt: new Date()
          }
        }
      )

      console.log(`🎉 ${tripData.title} imported successfully!`)
      console.log(`   📊 ${allActivities.length} activities created`)
      console.log(`   📅 ${tripDays.length} days organized`)
      console.log(`   🔗 Trip-activity relationships established`)
    }

    console.log('\n🎉 All trips imported successfully!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

if (require.main === module) {
  importNewTrips()
}

module.exports = { importNewTrips } 