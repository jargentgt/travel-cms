# Travel CMS - Frontend API Endpoints & Import Functions

This document describes the custom API endpoints designed for frontend consumption and CSV data import functionality.

## Frontend Data Endpoints

### 1. Get Trips List
**GET** `/api/trips`

Retrieves a paginated list of published trips with optional filtering.

#### Query Parameters:
- `limit` (optional) - Number of trips per page (default: 10)
- `page` (optional) - Page number (default: 1)
- `category` (optional) - Filter by category (adventure, culture, food, nature, etc.)
- `search` (optional) - Search in title, location, country, or tags

#### Example Request:
```bash
GET /api/trips?limit=5&page=1&category=adventure&search=jeju
```

#### Response Format:
```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "id": "trip_id",
        "title": "2025 Jeju Island Adventure",
        "slug": "2025-jeju-island-adventure",
        "location": "Jeju Island",
        "country": "South Korea",
        "startDate": "2025-01-01",
        "endDate": "2025-01-05",
        "categories": ["nature", "adventure"],
        "tags": ["island", "hiking"],
        "coverImage": {
          "id": "image_id",
          "url": "/media/image.jpg",
          "alt": "Jeju Island",
          "filename": "jeju.jpg"
        },
        "daysCount": 5
      }
    ],
    "totalDocs": 25,
    "totalPages": 5,
    "page": 1,
    "limit": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 2. Get Trip Detail
**GET** `/api/trips/[slug]`

Retrieves detailed information about a specific trip including all activities organized by days.

#### Path Parameters:
- `slug` - Trip slug identifier

#### Example Request:
```bash
GET /api/trips/2025-jeju-island-adventure
```

#### Response Format:
```json
{
  "success": true,
  "data": {
    "id": "trip_id",
    "title": "2025 Jeju Island Adventure",
    "slug": "2025-jeju-island-adventure",
    "location": "Jeju Island",
    "country": "South Korea",
    "startDate": "2025-01-01",
    "endDate": "2025-01-05",
    "categories": ["nature", "adventure"],
    "tags": ["island", "hiking"],
    "coverImage": {
      "id": "image_id",
      "url": "/media/image.jpg",
      "alt": "Jeju Island",
      "filename": "jeju.jpg"
    },
    "days": [
      {
        "date": "2025-01-01",
        "activities": [
          {
            "id": "activity_id",
            "title": "Airport Departure",
            "time": "09:00-11:00",
            "location": "Hong Kong International Airport",
            "description": "Flight to Jeju",
            "category": "airport",
            "type": "normal",
            "icon": "✈️",
            "order": 0
          }
        ]
      }
    ],
    "totalDays": 5,
    "totalActivities": 25
  }
}
```

## Data Import Endpoints

### 3. Import Complete Trip with Activities
**POST** `/api/import-trip`

Imports a complete trip with activities from a CSV file. Creates both the trip and all its activities.

#### Request Format (multipart/form-data):
- `csvFile` (File) - CSV file containing activity data
- `tripData` (String) - JSON string with trip information

#### Trip Data JSON Format:
```json
{
  "title": "2025 Jeju Island Adventure",
  "slug": "2025-jeju-island-adventure",
  "location": "Jeju Island",
  "country": "South Korea",
  "startDate": "2025-01-01",
  "endDate": "2025-01-05",
  "categories": ["nature", "adventure", "food"],
  "tags": ["island", "hiking", "seafood"],
  "status": "published"
}
```

#### CSV Format:
The CSV should contain columns for activity data. Supports both Chinese and English headers:

**Chinese Headers:**
- `日期` - Date (YYYY-MM-DD)
- `開始時間` - Start time
- `結束時間` - End time
- `活動摘要` - Activity title
- `地點` - Location
- `描述/備註` - Description
- `來源日曆` - Source (skip "Rain Plan" entries)

**English Headers:**
- `date` or `Date` - Date
- `start_time` or `StartTime` - Start time
- `end_time` or `EndTime` - End time
- `activity` or `Activity` or `Title` - Activity title
- `location` or `Location` - Location
- `description` or `Description` - Description
- `source` or `Source` - Source

#### Example JavaScript Usage:
```javascript
const formData = new FormData()
formData.append('csvFile', file)
formData.append('tripData', JSON.stringify(tripData))

const response = await fetch('/api/import-trip', {
  method: 'POST',
  body: formData
})

const result = await response.json()
```

#### Response Format:
```json
{
  "success": true,
  "message": "Trip imported successfully",
  "data": {
    "trip": {
      "id": "trip_id",
      "title": "2025 Jeju Island Adventure",
      "slug": "2025-jeju-island-adventure"
    },
    "statistics": {
      "activitiesCreated": 25,
      "days": 5,
      "totalActivities": 25
    }
  }
}
```

### 4. Import Activities to Existing Trip
**POST** `/api/import-activities`

Imports activities from a CSV file to an existing trip. Merges with existing activities and days.

#### Request Format (multipart/form-data):
- `csvFile` (File) - CSV file containing activity data
- `tripId` (String) - Existing trip ID

#### Example JavaScript Usage:
```javascript
const formData = new FormData()
formData.append('csvFile', file)
formData.append('tripId', 'existing_trip_id')

const response = await fetch('/api/import-activities', {
  method: 'POST',
  body: formData
})

const result = await response.json()
```

#### Response Format:
```json
{
  "success": true,
  "message": "Activities imported successfully",
  "data": {
    "trip": {
      "id": "trip_id",
      "title": "Trip Title",
      "slug": "trip-slug"
    },
    "statistics": {
      "activitiesCreated": 15,
      "totalProcessed": 20,
      "errors": 0,
      "newDays": 3
    },
    "errors": [] // Only present if there were errors
  }
}
```

## Smart Categorization

All imported activities are automatically categorized based on intelligent keyword mapping:

### Categories:
- **Airport** - Flight-related activities (飛, 機, airport, flight)
- **Hotel** - Accommodation (酒店, 飯店, hotel, 住宿)
- **Driving** - Car rental and driving (租車, driving, rental)
- **Transport** - General transportation (船, 巴士, bus, taxi)
- **Cafe** - Coffee shops and cafes (咖啡, cafe, coffee, 茶)
- **Restaurant** - Dining activities (餐廳, restaurant, 飯, 肉)
- **Shopping** - Shopping activities (購物, shopping, 市場)
- **Activity** - General activities (default for unmatched)

### Icon Assignment:
Activities are automatically assigned emoji icons based on title keywords:
- ✈️ Flight activities
- 🏨 Hotel/accommodation
- 🚗 Car/driving
- ☕ Cafe/coffee
- 🍽️ Restaurant/meals
- 🛍️ Shopping
- 📍 Default icon

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing parameters, invalid data)
- `404` - Not Found (trip not found)
- `500` - Server Error

## Frontend Integration Examples

### React/Next.js Examples:

```javascript
// Fetch trips list
const fetchTrips = async (page = 1, category = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '10'
  })
  if (category) params.append('category', category)
  
  const response = await fetch(`/api/trips?${params}`)
  return response.json()
}

// Fetch trip detail
const fetchTripDetail = async (slug) => {
  const response = await fetch(`/api/trips/${slug}`)
  return response.json()
}

// Import trip with CSV
const importTripData = async (csvFile, tripData) => {
  const formData = new FormData()
  formData.append('csvFile', csvFile)
  formData.append('tripData', JSON.stringify(tripData))
  
  const response = await fetch('/api/import-trip', {
    method: 'POST',
    body: formData
  })
  return response.json()
}
```

## Notes

- All dates are returned in ISO 8601 format
- All endpoints support CORS for frontend integration
- File uploads are limited by server configuration
- CSV parsing is flexible and supports multiple column name formats
- Activities are automatically sorted by date and order within each day 