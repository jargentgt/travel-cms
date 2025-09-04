import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { path: filePath } = await context.params
    const filename = filePath.join('/')
    
    return NextResponse.json({
      received_path: filePath,
      joined_filename: filename,
      decoded_filename: decodeURIComponent(filename),
      url: request.url,
      searchParams: Object.fromEntries(request.nextUrl.searchParams)
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
} 