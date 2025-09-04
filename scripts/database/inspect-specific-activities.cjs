#!/usr/bin/env node
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function inspectSpecificActivities() {
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
    
    // Look at specific activities that the search found
    const testNames = [
      '百濟蔘雞湯',
      'DAISO 高松中央店',
      '小雅茶飲-芋頭西米露',
      '去首爾'
    ]
    
    console.log('🔍 Inspecting specific activities with category markers:')
    
    for (const name of testNames) {
      const activity = await activitiesCollection.findOne({ title: name })
      
      if (activity) {
        console.log(`\n📝 Activity: ${activity.title}`)
        console.log(`   ID: ${activity._id}`)
        console.log(`   Category: ${activity.category}`)
        console.log(`   Description: "${activity.description}"`)
        console.log(`   Description length: ${activity.description ? activity.description.length : 'null'}`)
        
        if (activity.description) {
          console.log(`   First 200 chars: "${activity.description.substring(0, 200)}..."`)
        }
      } else {
        console.log(`\n❌ Activity not found: ${name}`)
      }
    }
    
    // Also search for any activity that contains the exact patterns in description
    console.log('\n🎯 Searching for activities with exact patterns in description:')
    
    const patterns = ['「restaurant]', '「shopping]', '「cafe]', '「airport]']
    
    for (const pattern of patterns) {
      const activities = await activitiesCollection.find({
        description: { $regex: pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
      }).limit(2).toArray()
      
      console.log(`\n${pattern}: ${activities.length} matches`)
      activities.forEach(activity => {
        console.log(`  - ${activity.title}`)
        console.log(`    Category: ${activity.category}`)
        console.log(`    Description: "${activity.description}"`)
        console.log(`    First line: "${activity.description ? activity.description.split('\n')[0] : 'none'}"`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error inspecting activities:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('📌 Database connection closed')
  }
}

if (require.main === module) {
  inspectSpecificActivities()
}

module.exports = { inspectSpecificActivities } 