# API Architecture Guide

## 🎯 Overview

This document outlines the API architecture for the Travel CMS project and provides best practices to prevent duplicate endpoints and maintain consistency.

## 🏗️ Current API Structure

### Next.js API Routes (Primary)
```
src/app/api/
├── frontend/                    # Public API endpoints
│   └── trips/
│       ├── route.ts            # GET /api/frontend/trips (trips list)
│       └── [slug]/route.ts     # GET /api/frontend/trips/[slug] (trip details)
├── media/                      # Media handling
├── serve-media/                # Media serving
└── debug/                      # Development debugging
```

### Payload Custom Endpoints (Admin/Import)
```
src/endpoints/
├── importTrip.ts              # POST /api/import-trip
├── importActivities.ts        # POST /api/import-activities  
├── updateActivitiesCategories.ts  # POST /api/update-activities-categories
└── test.ts                    # GET /api/test
```

## 🎯 Decision Matrix: When to Use What?

| **Use Next.js API Routes When** | **Use Payload Endpoints When** |
|----------------------------------|--------------------------------|
| ✅ Public-facing APIs | ✅ Admin/import operations |
| ✅ Complex data transformation | ✅ Simple Payload CRUD |
| ✅ Custom business logic | ✅ Leveraging Payload features |
| ✅ Third-party integrations | ✅ Quick prototyping |
| ✅ Custom middleware/auth | ✅ Built-in access control |

## 🚨 Avoiding Duplicate Endpoints

### ❌ What NOT to Do
```typescript
// DON'T: Create both for the same path
// src/endpoints/tripDetail.ts
const tripDetail: Endpoint = {
  path: '/frontend/trips/[slug]',  // ❌ DUPLICATE!
  // ...
}

// src/app/api/frontend/trips/[slug]/route.ts
export async function GET() {      // ❌ DUPLICATE!
  // ...
}
```

### ✅ What TO Do
```typescript
// Choose ONE approach per endpoint:

// Option 1: Next.js API Route (Recommended for public APIs)
// src/app/api/frontend/trips/[slug]/route.ts
export async function GET(request: NextRequest, context: RouteParams) {
  // Your logic here
}

// Option 2: Payload Endpoint (For admin/import functions)
// src/endpoints/importTrip.ts  
const importTrip: Endpoint = {
  path: '/admin/import-trip',
  method: 'post',
  handler: async (req) => {
    // Admin logic here
  }
}
```

## 📋 Endpoint Checklist

Before creating a new API endpoint:

- [ ] **Check for existing endpoints** with the same path
- [ ] **Choose the appropriate approach** (Next.js vs Payload)
- [ ] **Document the endpoint** in this file
- [ ] **Test thoroughly** to ensure no conflicts
- [ ] **Update frontend types** if needed

## 🔧 Current Endpoints

### Public APIs (Next.js Routes)
- `GET /api/frontend/trips` - List all published trips
- `GET /api/frontend/trips/[slug]` - Get trip details with activities and coordinates

### Admin APIs (Payload Endpoints)  
- `POST /api/import-trip` - Import trip data from CSV
- `POST /api/import-activities` - Import activities data
- `POST /api/update-activities-categories` - Bulk update activity categories
- `GET /api/test` - Development testing endpoint

### Media APIs (Next.js Routes)
- `GET /api/media/*` - Serve media files
- `GET /api/serve-media` - Alternative media serving
- `GET /api/media-debug/*` - Debug media issues

## 🎯 Best Practices

### 1. Naming Conventions
```typescript
// Public APIs: Use descriptive REST paths
/api/frontend/trips
/api/frontend/trips/[slug]

// Admin APIs: Use action-based paths  
/api/import-trip
/api/update-activities-categories
```

### 2. Response Format Consistency
```typescript
// Success Response
{
  "success": true,
  "data": { /* your data */ },
  "message": "Optional success message"
}

// Error Response
{
  "success": false, 
  "data": null,
  "message": "Error description",
  "error": "Optional error details"
}
```

### 3. CORS Handling
All endpoints should use the centralized CORS utility:
```typescript
import { getCorsHeaders } from '../utils/cors'

return NextResponse.json(data, {
  headers: getCorsHeaders(origin)
})
```

## 🔄 Migration History

### 2024-01 - Coordinate Fields Migration
- **Issue**: Group fields in Payload CMS were causing API issues
- **Solution**: Migrated to flattened structure
  - `coordinates.lat` → `latitude`  
  - `coordinates.lng` → `longitude`
  - `coordinates.source` → `coordinatesSource`
- **Migration**: 803 activities migrated successfully
- **Status**: ✅ **COMPLETED** - Migration scripts cleaned up, database permanently updated

### 2024-01 - Duplicate Endpoint Resolution
- **Issue**: Duplicate endpoints causing conflicts
  - Payload: `src/endpoints/tripDetail.ts` 
  - Next.js: `src/app/api/frontend/trips/[slug]/route.ts`
- **Solution**: Removed Payload duplicates, kept Next.js routes
- **Result**: Single source of truth for each endpoint

## 📝 Future Considerations

1. **API Versioning**: Consider versioning if breaking changes are needed
   ```
   /api/v1/frontend/trips
   /api/v2/frontend/trips  
   ```

2. **Rate Limiting**: Add rate limiting for public endpoints

3. **Caching**: Implement response caching for expensive operations

4. **Monitoring**: Add API usage monitoring and error tracking 