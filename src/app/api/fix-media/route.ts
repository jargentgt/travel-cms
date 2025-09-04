import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    // Get all media records
    const mediaRecords = await payload.find({
      collection: 'media',
      limit: 1000
    })
    
    // Get all files in upload directory
    const uploadDir = process.env.NODE_ENV === 'production' ? '/app/uploads' : 'public/media'
    const files = await fs.readdir(uploadDir)
    
    const report = {
      total_media_records: mediaRecords.docs.length,
      total_files: files.length,
      orphaned_records: [] as any[],
      missing_files: [] as string[],
      fixes_applied: [] as string[]
    }
    
    // Check for orphaned database records (records without files)
    for (const record of mediaRecords.docs) {
      if (record.filename && !files.includes(record.filename)) {
        report.orphaned_records.push({
          id: record.id,
          filename: record.filename,
          url: record.url
        })
      }
    }
    
    // Check for missing database records (files without records)
    for (const file of files) {
      const hasRecord = mediaRecords.docs.some(record => record.filename === file)
      if (!hasRecord) {
        report.missing_files.push(file)
      }
    }
    
    // Apply fixes if requested
    const shouldFix = request.nextUrl.searchParams.get('fix') === 'true'
    
    if (shouldFix) {
      // Delete orphaned records
      for (const orphan of report.orphaned_records) {
        try {
          await payload.delete({
            collection: 'media',
            id: orphan.id
          })
          report.fixes_applied.push(`Deleted orphaned record: ${orphan.filename}`)
        } catch (error) {
          report.fixes_applied.push(`Failed to delete ${orphan.filename}: ${String(error)}`)
        }
      }
    }
    
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to analyze media',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 