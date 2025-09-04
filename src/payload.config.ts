// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Trips } from './collections/Trips'
import { Activities } from './collections/Activities'
import updateActivitiesCategories from './endpoints/updateActivitiesCategories'
import tripsList from './endpoints/tripsList'
import tripDetail from './endpoints/tripDetail'
import importTrip from './endpoints/importTrip'
import importActivities from './endpoints/importActivities'
import test from './endpoints/test'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Parse CORS origins from environment variable
const getCorsOrigins = () => {
  const corsOrigins = process.env.CORS_ORIGINS
  if (corsOrigins) {
    return corsOrigins.split(',').map(origin => origin.trim())
  }
  // Default CORS origins for development
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://travel-adventures-4bcdc.web.app'
  ]
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Trips, Activities],
  endpoints: [
    updateActivitiesCategories,
    tripsList,
    tripDetail,
    importTrip,
    importActivities,
    test
  ],
  cors: getCorsOrigins(),
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || process.env.MONGODB_URI || '',
    connectOptions: {
      dbName: process.env.DATABASE_NAME || 'travel-cms',
    },
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
})
