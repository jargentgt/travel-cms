#!/usr/bin/env node
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function analyzeCategoryMarkers() {
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
    
    // Find all activities with descriptions
    console.log('🔍 Analyzing category markers in activity descriptions...')
    const allActivities = await activitiesCollection.find({
      description: { $exists: true, $ne: '' }
    }).toArray()
    
    console.log(`📊 Found ${allActivities.length} activities with descriptions`)
    
    const markerPatterns = new Map()
    const suspiciousActivities = []
    
    for (const activity of allActivities) {
      if (!activity.description) continue
      
      const firstLine = activity.description.split('\n')[0].trim()
      
      // Look for any potential markers at the start of the first line
      const possibleMarkers = [
        /^(\[([^\]]+)\])/,   // [{category}]
        /^(「([^\]]+)\])/,   // 「{category}]
        /^(「([^」]+)」)/,   // 「{category}」
        /^(\[([^」]+)」)/,   // [{category}」
        /^(【([^】]+)】)/,   // 【{category}】
        /^(〔([^〕]+)〕)/,   // 〔{category}〕
      ]
      
      let foundMarker = null
      
      for (const pattern of possibleMarkers) {
        const match = firstLine.match(pattern)
        if (match) {
          foundMarker = match[1]
          break
        }
      }
      
      if (foundMarker) {
        const count = markerPatterns.get(foundMarker) || 0
        markerPatterns.set(foundMarker, count + 1)
        
        suspiciousActivities.push({
          id: activity._id,
          title: activity.title,
          category: activity.category,
          marker: foundMarker,
          firstLine: firstLine,
          fullDescription: activity.description
        })
      }
      
      // Also check for potential markers that might not be at the very start
      const lineContainsMarker = /[\[「【〔][^[\]」】〕]*[\]」】〕]/.test(firstLine)
      if (lineContainsMarker && !foundMarker) {
        suspiciousActivities.push({
          id: activity._id,
          title: activity.title,
          category: activity.category,
          marker: 'PATTERN_NOT_MATCHED',
          firstLine: firstLine,
          fullDescription: activity.description
        })
      }
    }
    
    console.log('\n📋 Marker Pattern Analysis:')
    console.log(`🏷️  Total unique markers found: ${markerPatterns.size}`)
    console.log(`🔍 Total activities with markers: ${suspiciousActivities.length}`)
    
    if (markerPatterns.size > 0) {
      console.log('\n📊 Marker frequency:')
      const sortedMarkers = Array.from(markerPatterns.entries())
        .sort((a, b) => b[1] - a[1])
      
      sortedMarkers.forEach(([marker, count]) => {
        console.log(`  ${marker}: ${count} times`)
      })
    }
    
    console.log('\n🔍 Sample activities with markers:')
    suspiciousActivities.slice(0, 20).forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.title}`)
      console.log(`   ID: ${activity.id}`)
      console.log(`   Current Category: ${activity.category}`)
      console.log(`   Marker: ${activity.marker}`)
      console.log(`   First Line: "${activity.firstLine}"`)
      console.log('')
    })
    
    if (suspiciousActivities.length > 20) {
      console.log(`... and ${suspiciousActivities.length - 20} more activities`)
    }
    
    // Look specifically for the patterns the user mentioned
    console.log('\n🎯 Searching for specific patterns mentioned by user:')
    const userPatterns = ['「airport]', '「shopping]', '「cafe]', '「restaurant]']
    
    for (const pattern of userPatterns) {
      const matches = suspiciousActivities.filter(activity => 
        activity.firstLine.includes(pattern)
      )
      console.log(`${pattern}: ${matches.length} matches`)
      if (matches.length > 0) {
        matches.slice(0, 3).forEach(match => {
          console.log(`  - ${match.title}: "${match.firstLine}"`)
        })
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing activities:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('📌 Database connection closed')
  }
}

if (require.main === module) {
  analyzeCategoryMarkers()
}

module.exports = { analyzeCategoryMarkers } 