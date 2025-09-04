import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface RouteParams {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { path: filePath } = await context.params
    const filename = filePath.join('/')
    
    // Determine upload directory based on environment
    const uploadDir = process.env.NODE_ENV === 'production' ? '/app/uploads' : 'public/media'
    const fullPath = path.join(uploadDir, filename)
    
    // Check if file exists
    try {
      await fs.access(fullPath)
    } catch {
      return new NextResponse('File not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        }
      })
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(fullPath)
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (ext) {
      case '.webp':
        contentType = 'image/webp'
        break
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.svg':
        contentType = 'image/svg+xml'
        break
    }
    
    // Return the file with proper headers for admin interface
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        // No CORS restrictions for same-origin admin requests
      }
    })
  } catch (error) {
    console.error('Error serving admin media file:', error)
    return new NextResponse('Internal server error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      }
    })
  }
} 