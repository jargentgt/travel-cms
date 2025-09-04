#!/usr/bin/env node
const { MongoClient, ObjectId } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

function parseCategoryFromDescription(description) {
  if (!description) return { category: null, cleanDescription: description }
  
  // Check for category markers in first line: [{category}], 「{category}], 「{category}」, [{category}」
  const firstLine = description.split('\n')[0].trim()
  const categoryPatterns = [
    /^\[([^\]]+)\]/, // [{category}]
    /^「([^\]]+)\]/, // 「{category}]
    /^「([^」]+)」/, // 「{category}」
    /^\[([^」]+)」/  // [{category}」
  ]
  
  for (const pattern of categoryPatterns) {
    const match = firstLine.match(pattern)
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
      
      // Remove the category line from description
      const remainingLines = description.split('\n').slice(1)
      const cleanDescription = remainingLines.join('\n').trim()
      
      return { category, cleanDescription: cleanDescription || '', originalMarker: match[0] }
    }
  }
  
  return { category: null, cleanDescription: description }
}

async function updateActivityCategories() {
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
    const activitiesCollection = db.collection('activities')
    
    // Find all activities
    console.log('🔍 Finding activities with category markers in descriptions...')
    const allActivities = await activitiesCollection.find({}).toArray()
    console.log(`📊 Found ${allActivities.length} total activities`)
    
    let updatedCount = 0
    let foundMarkersCount = 0
    const updateLog = []
    
    for (const activity of allActivities) {
      const { category: parsedCategory, cleanDescription, originalMarker } = parseCategoryFromDescription(activity.description)
      
      if (parsedCategory && originalMarker) {
        foundMarkersCount++
        
        // Check if we need to update the category or description
        const needsCategoryUpdate = activity.category !== parsedCategory
        const needsDescriptionUpdate = activity.description !== cleanDescription
        
        if (needsCategoryUpdate || needsDescriptionUpdate) {
          const updateFields = {}
          
          if (needsCategoryUpdate) {
            updateFields.category = parsedCategory
          }
          
          if (needsDescriptionUpdate) {
            updateFields.description = cleanDescription
          }
          
          updateFields.updatedAt = new Date()
          
          // Update the activity
          await activitiesCollection.updateOne(
            { _id: activity._id },
            { $set: updateFields }
          )
          
          updatedCount++
          
          const logEntry = {
            id: activity._id,
            title: activity.title,
            originalMarker,
            oldCategory: activity.category,
            newCategory: parsedCategory,
            categoryChanged: needsCategoryUpdate,
            descriptionCleaned: needsDescriptionUpdate
          }
          updateLog.push(logEntry)
          
          console.log(`✅ Updated: ${activity.title}`)
          console.log(`   🏷️  Marker: ${originalMarker}`)
          if (needsCategoryUpdate) {
            console.log(`   📂 Category: ${activity.category} → ${parsedCategory}`)
          }
          if (needsDescriptionUpdate) {
            console.log(`   📝 Description: Cleaned (removed marker)`)
          }
          console.log('')
        } else {
          console.log(`ℹ️  Already up-to-date: ${activity.title} (${originalMarker})`)
        }
      }
    }
    
    console.log('\n📋 Update Summary:')
    console.log(`📊 Total activities: ${allActivities.length}`)
    console.log(`🏷️  Activities with category markers: ${foundMarkersCount}`)
    console.log(`✅ Activities updated: ${updatedCount}`)
    console.log(`ℹ️  Activities already correct: ${foundMarkersCount - updatedCount}`)
    
    if (updateLog.length > 0) {
      console.log('\n📄 Detailed Update Log:')
      updateLog.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.title}`)
        console.log(`   ID: ${entry.id}`)
        console.log(`   Marker: ${entry.originalMarker}`)
        if (entry.categoryChanged) {
          console.log(`   Category: ${entry.oldCategory} → ${entry.newCategory}`)
        }
        if (entry.descriptionCleaned) {
          console.log(`   Description: Cleaned`)
        }
        console.log('')
      })
    }
    
    console.log('🎉 Category update process completed!')
    
  } catch (error) {
    console.error('❌ Error updating activities:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('📌 Database connection closed')
  }
}

if (require.main === module) {
  updateActivityCategories()
}

module.exports = { updateActivityCategories, parseCategoryFromDescription } 