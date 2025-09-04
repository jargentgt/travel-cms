# Travel CMS - Trips and Activities Implementation

This document outlines the implementation of the Trips and Activities entities extracted from the travel-payload-cms project.

## Implemented Components

### 1. Collection Schemas

#### Trips Collection (`src/collections/Trips.ts`)
- **Fields:**
  - `title` - Trip title (e.g., "2025 Jeju Island Adventure")
  - `slug` - URL-friendly identifier (auto-generated from title)
  - `location` - Primary trip location
  - `country` - Country where the trip takes place
  - `coverImage` - Cover image upload (media relation)
  - `startDate` & `endDate` - Trip duration
  - `categories` - Multi-select categories (Adventure, Culture, Food, Nature, etc.)
  - `tags` - Array of search tags
  - `days` - Array of trip days with date and activities relationship
  - `status` - Draft or Published

#### Activities Collection (`src/collections/Activities.ts`)
- **Fields:**
  - `title` - Activity name
  - `time` - Time or time range (e.g., "09:00-12:00")
  - `location` - Specific activity location
  - `description` - Activity description/notes
  - `category` - Activity type (Airport, Hotel, Driving, Transport, Cafe, Restaurant, Shopping, Activity)
  - `type` - Normal or Rain Plan
  - `icon` - Emoji icon for the activity
  - `date` - Activity date
  - `trip` - Relationship to trips collection
  - `order` - Sorting order within day

### 2. API Endpoints

#### Update Activities Categories (`src/endpoints/updateActivitiesCategories.ts`)
- **Path:** `/api/update-activities-categories`
- **Method:** GET
- **Parameters:** 
  - `tripId` (optional) - Update activities for specific trip
  - If no tripId provided, updates all activities
- **Function:** Bulk update activity categories based on smart keyword mapping

### 3. Utilities

#### Category Mapping Utility (`src/utilities/updateActivitiesCategories.ts`)
- **Smart categorization** based on Chinese and English keywords:
  - `airport` - Flight-related activities
  - `hotel` - Accommodation activities  
  - `driving` - Car rental and driving
  - `transport` - General transportation
  - `cafe` - Coffee shops and cafes
  - `restaurant` - Dining activities
  - `shopping` - Shopping activities
- **Functions:**
  - `updateActivitiesForTrip()` - Update activities for specific trip
  - `updateActivitiesForAllTrips()` - Update all activities
  - Automatic icon removal and category remapping

### 4. Data Import Functions

#### CSV Import Script (`import-trips-data.js`)
- **Features:**
  - Parse CSV files with trip activity data
  - Support multiple CSV column formats (Chinese/English)
  - Automatic icon assignment based on activity titles
  - Smart category mapping
  - Automatic trip day organization
  - Relationship management between trips and activities

- **Icon Mapping:** Maps Chinese keywords to emoji icons
- **Category Mapping:** Intelligent categorization based on activity titles
- **Usage Example:**
  ```javascript
  import { importTripData } from './import-trips-data.js'
  
  const tripInfo = {
    title: '2025 Jeju Island Adventure',
    slug: '2025-jeju-island-adventure',
    location: 'Jeju Island',
    country: 'South Korea',
    startDate: '2025-01-01',
    endDate: '2025-01-05',
    categories: ['nature', 'adventure', 'food'],
    tags: ['island', 'hiking', 'seafood'],
    status: 'published'
  }
  
  await importTripData('./path/to/your/trip-data.csv', tripInfo)
  ```

## Configuration Updates

### Payload Config (`src/payload.config.ts`)
- Added Trips and Activities collections
- Added updateActivitiesCategories endpoint
- Updated type generation

### Package Dependencies
- Added `papaparse` for CSV parsing
- Added `@types/papaparse` for TypeScript support

## Usage Instructions

### 1. Development Setup
```bash
# Generate types after adding collections
pnpm run generate:types

# Start development server
pnpm dev
```

### 2. Access Admin Panel
- Navigate to `/admin` 
- Create trips and activities through the CMS interface
- Use the bulk category update endpoint for data management

### 3. Data Import
- Prepare CSV files with activity data
- Use the `importTripData` function to import trips and activities
- CSV format supports both Chinese and English column headers

### 4. API Usage
- **Update Categories:** `GET /api/update-activities-categories?tripId=<id>`
- **Update All:** `GET /api/update-activities-categories`

## Database Relationships

```
Trips (1) ←→ (Many) Activities
   ↓
Days Array → Activities References
```

- Each trip contains an array of days
- Each day references multiple activities
- Activities belong to one trip and one specific date
- Activities are automatically organized by date into trip days

## Features

- ✅ **Smart Categorization** - Automatic activity categorization based on keywords
- ✅ **Multi-language Support** - Handles Chinese and English content
- ✅ **CSV Import** - Batch import from spreadsheet data
- ✅ **Icon Mapping** - Automatic emoji assignment
- ✅ **Relationship Management** - Automatic trip-activity linking
- ✅ **Railway Deployment Ready** - All configurations included
- ✅ **TypeScript Support** - Full type safety
- ✅ **Admin Interface** - User-friendly CMS interface 