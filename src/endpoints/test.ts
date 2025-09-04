import type { Endpoint } from 'payload'

const test: Endpoint = {
  path: '/test',
  method: 'get',
  handler: async (req) => {
    return Response.json({
      success: true,
      message: 'Test endpoint working!',
      timestamp: new Date().toISOString()
    })
  },
}

export default test 