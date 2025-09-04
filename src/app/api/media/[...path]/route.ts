import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getCorsHeaders } from '@/utils/cors'

interface RouteParams {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  const origin = request.headers.get('origin') || undefined
  
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
        headers: getCorsHeaders(origin)
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
    
    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...getCorsHeaders(origin)
      }
    })
  } catch (error) {
    console.error('Error serving media file:', error)
    return new NextResponse('Internal server error', {
      status: 500,
      headers: getCorsHeaders(origin)
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || undefined
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin)
  })
} 