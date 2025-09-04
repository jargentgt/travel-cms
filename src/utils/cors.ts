// CORS utility for custom endpoints
export function getCorsHeaders(origin?: string): Record<string, string> {
  const corsOrigins = process.env.CORS_ORIGINS
  const allowedOrigins = corsOrigins 
    ? corsOrigins.split(',').map(origin => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001', 
        'https://travel-adventures-4bcdc.web.app'
      ]

  // Check if the origin is allowed
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  }
}

export function createCorsResponse(data: any, status: number = 200, origin?: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin)
    }
  })
}

export function handleOptionsRequest(origin?: string): Response {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin)
  })
} 