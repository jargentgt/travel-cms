import type { Endpoint } from 'payload'
import Papa from 'papaparse'

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

function getIconForActivity(title: string): string {
  for (const [keyword, icon] of Object.entries(ICON_MAP)) {
    if (title.includes(keyword)) {
      return icon
    }
  }
  return '📍' // Default icon
}

function getCategoryForActivity(title: string): string {
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (title.includes(keyword)) {
      return category
    }
  }
  return 'activity' // Default category
}

function parseCSVData(csvData: any[]) {
  const activities: any[] = []
  
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

      const activity = {
        time: timeRange,
        title: title,
        location: location || '',
        description: description || '',
        category: getCategoryForActivity(title),
        icon: getIconForActivity(title),
        type: 'normal'
      }

      activities.push({ date, activity })
    } catch (error) {
      console.warn('Error parsing CSV row:', error, row)
    }
  }

  return activities
}

const importTrip: Endpoint = {
  path: '/import-trip',
  method: 'post',
  handler: async (req) => {
    try {
      const { payload } = req

      if (!payload) {
        return Response.json(
          { success: false, message: 'Payload instance not available' },
          { status: 500 }
        )
      }

      // Check if request has formData method
      if (!req.formData) {
        return Response.json(
          { success: false, message: 'FormData not supported' },
          { status: 400 }
        )
      }

      // Parse the request body
      const formData = await req.formData()
      const csvFile = formData.get('csvFile') as File
      const tripDataStr = formData.get('tripData') as string

      if (!csvFile || !tripDataStr) {
        return Response.json(
          { success: false, message: 'CSV file and trip data are required' },
          { status: 400 }
        )
      }

      let tripData
      try {
        tripData = JSON.parse(tripDataStr)
      } catch (error) {
        return Response.json(
          { success: false, message: 'Invalid trip data JSON' },
          { status: 400 }
        )
      }

      // Read CSV file content
      const csvContent = await csvFile.text()
      const csvData = Papa.parse(csvContent, { header: true }).data
      console.log(`📊 Parsed ${csvData.length} rows from CSV`)

      // Parse activities from CSV
      const parsedActivities = parseCSVData(csvData)
      console.log(`✅ Successfully parsed ${parsedActivities.length} activities`)

      // Create or find the trip
      let trip
      try {
        // Check if trip already exists
        const existingTrip = await payload.find({
          collection: 'trips',
          where: {
            slug: { equals: tripData.slug }
          }
        })

        if (existingTrip.docs.length > 0) {
          trip = existingTrip.docs[0]
          console.log(`📋 Found existing trip: ${trip.title}`)
        } else {
          // Create new trip
          trip = await payload.create({
            collection: 'trips',
            data: tripData
          })
          console.log(`🎯 Created new trip: ${trip.title}`)
        }
      } catch (error) {
        console.error('❌ Error creating/finding trip:', error)
        return Response.json(
          { success: false, message: `Error creating trip: ${error}` },
          { status: 500 }
        )
      }

      // Import activities
      let createdCount = 0
      const dayGroups: { [key: string]: string[] } = {}

      for (const { date, activity } of parsedActivities) {
        try {
          const activityData = {
            ...activity,
            date: new Date(date),
            trip: trip.id,
            order: createdCount
          }

          const createdActivity = await payload.create({
            collection: 'activities',
            data: activityData
          })

          // Group activities by date for trip days
          const dateKey = new Date(date).toISOString().split('T')[0]
          if (!dayGroups[dateKey]) {
            dayGroups[dateKey] = []
          }
          dayGroups[dateKey].push(createdActivity.id)

          createdCount++
          console.log(`✅ Created activity: ${activity.title} (${dateKey})`)
        } catch (error) {
          console.error(`❌ Error creating activity "${activity.title}":`, error)
        }
      }

      // Update trip with organized days
      const tripDays = Object.entries(dayGroups).map(([date, activityIds]) => ({
        date: date, // Keep as string format
        activities: activityIds
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      await payload.update({
        collection: 'trips',
        id: trip.id,
        data: {
          days: tripDays
        }
      })

      return Response.json({
        success: true,
        message: 'Trip imported successfully',
        data: {
          trip: {
            id: trip.id,
            title: trip.title,
            slug: trip.slug
          },
          statistics: {
            activitiesCreated: createdCount,
            days: tripDays.length,
            totalActivities: parsedActivities.length
          }
        }
      })

    } catch (error) {
      console.error('❌ Import failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return Response.json(
        {
          success: false,
          message: `Import failed: ${errorMessage}`,
          data: null
        },
        { status: 500 }
      )
    }
  },
}

export default importTrip 