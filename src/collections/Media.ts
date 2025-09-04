import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: () => true,  // Allow uploads
    update: () => true,  // Allow updates
    delete: () => true,  // Allow deletion
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,  // Make alt field optional
    },
  ],
  upload: {
    // Use Railway volume path in production, local path in development
    staticDir: process.env.NODE_ENV === 'production' ? '/app/uploads' : 'public/media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card', 
        width: 768,
        height: 1024,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: ['image/*'],
    formatOptions: {
      format: 'webp',
      options: {
        quality: 80,
      },
    },
    // Add file size limits to handle larger images
    resizeOptions: {
      width: 2048,
      height: 2048,
      position: 'centre',
      fit: 'inside',
    },
    // Enable admin preview by serving files directly
    disableLocalStorage: false,
  },
}
