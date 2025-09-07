import type { CollectionConfig } from 'payload'

export const Activities: CollectionConfig = {
  slug: 'activities',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'trip', 'date', 'time', 'type', 'category', 'latitude', 'longitude'],
    listSearchableFields: ['title', 'location', 'description'],
  },
  access: {
    read: () => true, // Public access for frontend
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Activity title/name',
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: {
        description: 'Time or time range (e.g., "09:00-12:00" or "Morning")',
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'Specific location for this activity',
      },
    },
    {
      name: 'latitude',
      type: 'number',
      admin: {
        description: '📍 Latitude coordinate (auto-populated during import)',
        step: 0.000001,
        width: '50%',
      },
    },
    {
      name: 'longitude',
      type: 'number',
      admin: {
        description: '📍 Longitude coordinate (auto-populated during import)',
        step: 0.000001,
        width: '50%',
      },
    },
    {
      name: 'coordinatesSource',
      type: 'select',
      defaultValue: 'google',
      options: [
        { label: '🌐 Google Geocoding API', value: 'google' },
        { label: '🔗 Extracted from URL', value: 'extracted' },
        { label: '✋ Manual Input', value: 'manual' },
        { label: '📥 CSV Import', value: 'imported' },
      ],
      admin: {
        description: 'How these coordinates were obtained',
        width: '100%',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Activity description or notes',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Airport', value: 'airport' },
        { label: 'Hotel', value: 'hotel' },
        { label: 'Driving', value: 'driving' },
        { label: 'Transport', value: 'transport' },
        { label: 'Cafe', value: 'cafe' },
        { label: 'Restaurant', value: 'restaurant' },
        { label: 'Shopping', value: 'shopping' },
        { label: 'Activity', value: 'activity' },
      ],
      admin: {
        description: 'Type of activity',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'normal',
      options: [
        { label: 'Normal', value: 'normal' },
        { label: 'Rain Plan', value: 'rain_plan' },
      ],
      admin: {
        description: 'Activity type: normal activity or backup rain plan',
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Emoji icon for the activity',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
        description: 'Date when this activity takes place',
      },
    },
    {
      name: 'trip',
      type: 'relationship',
      relationTo: 'trips',
      required: true,
      admin: {
        description: 'Trip this activity belongs to',
      },
    },
    {
      name: 'order',
      type: 'number',
      admin: {
        description: 'Order of activity within the day (for sorting)',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Ensure we have an order value for sorting
        if (data.order === undefined || data.order === null) {
          data.order = 0
        }
        return data
      },
    ],
  },
} 