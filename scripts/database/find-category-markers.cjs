#!/usr/bin/env node
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function findCategoryMarkers() {
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
    
    console.log('🔍 Searching for category markers...')
    
    // Search for specific terms the user mentioned
    const searchTerms = ['airport', 'shopping', 'cafe', 'restaurant', 'transport', 'hotel', 'activity']
    
    console.log('\n🎯 Searching for category terms in brackets/quotes:')
    
    for (const term of searchTerms) {
      // Search for various bracket combinations with these terms
      const patterns = [
        new RegExp(`\\[${term}\\]`, 'i'),
        new RegExp(`「${term}\\]`, 'i'),
        new RegExp(`「${term}」`, 'i'),
        new RegExp(`\\[${term}」`, 'i'),
        new RegExp(`【${term}】`, 'i'),
      ]
      
      for (const pattern of patterns) {
        const activities = await activitiesCollection.find({
          description: { $regex: pattern }
        }).toArray()
        
        if (activities.length > 0) {
          console.log(`\n${pattern.source}: ${activities.length} matches`)
          activities.slice(0, 5).forEach(activity => {
            const firstLine = activity.description.split('\n')[0].trim()
            console.log(`  - ${activity.title}: "${firstLine.substring(0, 100)}..."`)
          })
        }
      }
    }
    
    console.log('\n🔍 Searching for any activities with bracket patterns at start of description:')
    
    // Search for any activities that start with bracket patterns
    const startPatterns = [
      /^\s*\[/,     // [anything]
      /^\s*「/,     // 「anything]
      /^\s*【/,     // 【anything】
      /^\s*〔/,     // 〔anything〕
    ]
    
    for (const pattern of startPatterns) {
      const activities = await activitiesCollection.find({
        description: { $regex: pattern }
      }).toArray()
      
      if (activities.length > 0) {
        console.log(`\nPattern ${pattern.source}: ${activities.length} matches`)
        activities.slice(0, 3).forEach(activity => {
          const firstLine = activity.description.split('\n')[0].trim()
          console.log(`  - ${activity.title}: "${firstLine}"`)
          console.log(`    Category: ${activity.category}`)
        })
      }
    }
    
    console.log('\n🎯 Direct text search for user-mentioned patterns:')
    const userPatterns = ['「airport]', '「shopping]', '「cafe]', '「restaurant]']
    
    for (const pattern of userPatterns) {
      const activities = await activitiesCollection.find({
        description: { $regex: pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
      }).toArray()
      
      console.log(`${pattern}: ${activities.length} exact matches`)
      if (activities.length > 0) {
        activities.forEach(activity => {
          console.log(`  - ${activity.title}: ${activity.description.split('\n')[0]}`)
        })
      }
    }
    
    console.log('\n📊 General statistics:')
    const total = await activitiesCollection.countDocuments()
    const withDesc = await activitiesCollection.countDocuments({ description: { $exists: true, $ne: '' } })
    console.log(`Total activities: ${total}`)
    console.log(`Activities with descriptions: ${withDesc}`)
    
  } catch (error) {
    console.error('❌ Error searching activities:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('📌 Database connection closed')
  }
}

if (require.main === module) {
  findCategoryMarkers()
}

module.exports = { findCategoryMarkers } 