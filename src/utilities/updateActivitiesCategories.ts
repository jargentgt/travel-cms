import type { Payload } from 'payload'

// Detailed keyword mapping based on user requirements
const categoryKeywords = {
  airport: ['飛', '機', '飛機', '機場', 'airport', 'flight', 'departure', 'arrival'],
  hotel: ['酒店', '飯店', '旅館', '旅店', 'hotel', '住宿', '君悅', '汗蒸幕', 'spa'],
  driving: ['租', '車', 'rent-a-car', 'rental', 'driving', 'sk rent'],
  transport: ['船', '接駁', '巴士', '去', '回', '番', 'bus', '地鐵', 'taxi', 'shuttle', 'transport'],
  cafe: ['橘子', '舒芙蕾', '咖啡店', 'cafe', 'café', '冰', 'bagel', 'bakery', '蛋', '糕', 'harbs', '外帶', '栗', '抹茶', '奶油', '起司', '咖啡', 'coffee', 'eggdrop', '茶', 'tea'],
  restaurant: ['豬', '魚', '雞', '海', '鮮', '熟', '鍋', '牛', '飯', '湯', '蟹', '醬', '麵', 'pasta', '豆', '燉', '炒', '豚', '餐', '寿司', '肉', '餃', '讃岐', '麦', '屋', '燒', '鶏', '鮭', '鮪', '麺', '餐廳', 'restaurant', '食', 'meal', 'dinner', 'lunch', 'breakfast', '烤肉', 'bbq'],
  shopping: ['市', '商', '店', '購', 'mart', 'shopping', 'olive young', '7-11', 'gs25', 'cu', 'family mart']
}

// Category mapping function
function mapToCategory(title: string = '', description: string = ''): string {
  const text = `${title} ${description}`.toLowerCase()
  
  // Check transport keywords first (more specific terms)
  if (categoryKeywords.transport.some(keyword => text.includes(keyword.toLowerCase()))) {
    return 'transport'
  }
  
  // Check other categories
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === 'transport') continue // already checked above
    
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }
  
  // Default to activity for everything else
  return 'activity'
}

export interface UpdateResult {
  totalActivities: number
  updatedCount: number
  categoryDistribution: Record<string, number>
  success: boolean
  message: string
}

/**
 * Update activities for a specific trip by removing icon field and remapping categories
 * @param payload - Payload CMS instance
 * @param tripId - Trip ID to update activities for
 * @returns Promise<UpdateResult>
 */
export async function updateActivitiesForTrip(
  payload: Payload,
  tripId: string
): Promise<UpdateResult> {
  try {
    // Find all activities for the specified trip
    const activities = await payload.find({
      collection: 'activities',
      where: {
        trip: {
          equals: tripId,
        },
      },
      limit: 1000, // Adjust as needed
    })

    if (activities.docs.length === 0) {
      return {
        totalActivities: 0,
        updatedCount: 0,
        categoryDistribution: {},
        success: true,
        message: `No activities found for trip ID: ${tripId}`,
      }
    }

    console.log(`📋 Found ${activities.docs.length} activities to process`)

    let updatedCount = 0
    const categoryCount: Record<string, number> = {}

    // Process each activity
    for (const activity of activities.docs) {
      let needsUpdate = false
      const updateData: any = {}

      // Map to new category based on title and description
      const newCategory = mapToCategory(activity.title || '', activity.description || '')

      // Check if category needs updating
      if (activity.category !== newCategory) {
        updateData.category = newCategory
        needsUpdate = true
      }

      // Remove icon field if it exists (by not including it in the update)
      if (activity.icon !== undefined) {
        needsUpdate = true
      }

      // Count category distribution
      categoryCount[newCategory] = (categoryCount[newCategory] || 0) + 1

      // Update the activity if needed
      if (needsUpdate) {
        await payload.update({
          collection: 'activities',
          id: activity.id,
          data: updateData,
        })
        updatedCount++
        console.log(`✅ Updated activity: ${activity.title} -> ${newCategory}`)
      }
    }

    return {
      totalActivities: activities.docs.length,
      updatedCount,
      categoryDistribution: categoryCount,
      success: true,
      message: `Successfully processed ${activities.docs.length} activities for trip ${tripId}. Updated ${updatedCount} activities.`,
    }

  } catch (error) {
    console.error('❌ Error updating activities for trip:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return {
      totalActivities: 0,
      updatedCount: 0,
      categoryDistribution: {},
      success: false,
      message: `Error updating activities for trip ${tripId}: ${errorMessage}`,
    }
  }
}

/**
 * Update activities for all trips by removing icon field and remapping categories
 * @param payload - Payload CMS instance
 * @returns Promise<UpdateResult>
 */
export async function updateActivitiesForAllTrips(payload: Payload): Promise<UpdateResult> {
  try {
    // Find all activities
    const activities = await payload.find({
      collection: 'activities',
      limit: 1000, // Adjust as needed
    })

    if (activities.docs.length === 0) {
      return {
        totalActivities: 0,
        updatedCount: 0,
        categoryDistribution: {},
        success: true,
        message: 'No activities found',
      }
    }

    console.log(`📋 Found ${activities.docs.length} activities to process`)

    let updatedCount = 0
    const categoryCount: Record<string, number> = {}

    // Process each activity
    for (const activity of activities.docs) {
      let needsUpdate = false
      const updateData: any = {}

      // Map to new category based on title and description
      const newCategory = mapToCategory(activity.title || '', activity.description || '')

      // Check if category needs updating
      if (activity.category !== newCategory) {
        updateData.category = newCategory
        needsUpdate = true
      }

      // Remove icon field if it exists (by not including it in the update)
      if (activity.icon !== undefined) {
        needsUpdate = true
      }

      // Count category distribution
      categoryCount[newCategory] = (categoryCount[newCategory] || 0) + 1

      // Update the activity if needed
      if (needsUpdate) {
        await payload.update({
          collection: 'activities',
          id: activity.id,
          data: updateData,
        })
        updatedCount++
        console.log(`✅ Updated activity: ${activity.title} -> ${newCategory}`)
      }
    }

    return {
      totalActivities: activities.docs.length,
      updatedCount,
      categoryDistribution: categoryCount,
      success: true,
      message: `Successfully processed ${activities.docs.length} activities. Updated ${updatedCount} activities.`,
    }

  } catch (error) {
    console.error('❌ Error updating activities for all trips:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return {
      totalActivities: 0,
      updatedCount: 0,
      categoryDistribution: {},
      success: false,
      message: `Error updating activities: ${errorMessage}`,
    }
  }
} 