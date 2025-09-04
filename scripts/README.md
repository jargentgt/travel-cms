# CMS Scripts Documentation

This folder contains organized scripts for managing the Travel CMS database, imports, and trip data.

## 📁 Folder Structure

```
scripts/
├── database/     # Database analysis and repair tools
├── import/       # Data import utilities
├── trips/        # Trip-specific management tools
└── README.md     # This documentation
```

## 🚀 Quick Start

Run any script using npm:

```bash
# Show all available scripts
npm run scripts:help

# Check database health
npm run db:check

# Analyze trip references  
npm run db:analyze <mongodb-uri>

# Fix trip day mappings
npm run trips:fix-days <tripId> <startDate>
```

## 🗄️ Database Scripts

### `db:check`
**File**: `scripts/database/check-database.cjs`  
**Purpose**: Inspect local database contents and structure  
**Usage**: `npm run db:check`  
**Example**:
```bash
npm run db:check
```

### `db:analyze`
**File**: `scripts/database/analyze-trip-references.cjs`  
**Purpose**: Analyze trip-activity reference consistency (production safe)  
**Usage**: `npm run db:analyze <mongodb-uri> [database-name]`  
**Example**:
```bash
npm run db:analyze "mongodb://user:pass@host:port" travel-cms
```

### `db:fix-refs`
**File**: `scripts/database/fix-trip-references.cjs`  
**Purpose**: Fix string trip references to ObjectIds (local database)  
**Usage**: `npm run db:fix-refs`  
**Example**:
```bash
npm run db:fix-refs
```

### `db:fix-refs-prod`
**File**: `scripts/database/fix-trip-references-prod.cjs`  
**Purpose**: Fix string trip references to ObjectIds (production database)  
**Usage**: `npm run db:fix-refs-prod <mongodb-uri> [database-name]`  
**Example**:
```bash
npm run db:fix-refs-prod "mongodb://user:pass@host:port" travel-cms
```

## 📥 Import Scripts

### `import:trips`
**File**: `scripts/import/import-trips-data.js`  
**Purpose**: Import trip data from CSV files  
**Usage**: `npm run import:trips`  
**Example**:
```bash
npm run import:trips
```

## 🗓️ Trip Management Scripts

### `trips:fix-days`
**File**: `scripts/trips/fix-trip-days.cjs`  
**Purpose**: Fix trip day mappings and remove empty days  
**Usage**: `npm run trips:fix-days <tripId> <expectedStartDate>`  
**Example**:
```bash
npm run trips:fix-days 68b474b171c114485c247b4b 2025-09-20
```

## 🔧 Script Development

### Environment Setup
All scripts automatically load environment variables from:
- `.env` (local development)
- `.env.local` (local overrides)

### Required Environment Variables
```bash
DATABASE_URI=mongodb://localhost:27017/travel-cms
# or
MONGODB_URI=mongodb://localhost:27017/travel-cms
```

### Adding New Scripts

1. Create the script in the appropriate subfolder:
   - `database/` - Database operations
   - `import/` - Data import tools  
   - `trips/` - Trip management utilities

2. Add npm script to `package.json`:
   ```json
   "script-name": "node scripts/folder/script-name.cjs"
   ```

3. Update the help text in `scripts:help`

### Script Template
```javascript
#!/usr/bin/env node
const { MongoClient, ObjectId } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })

async function yourFunction() {
  const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('❌ MongoDB URI not found in environment variables')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    // Your logic here
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

if (require.main === module) {
  yourFunction()
}

module.exports = { yourFunction }
```

## 🛡️ Safety Guidelines

1. **Always backup before running production scripts**
2. **Test scripts locally first**
3. **Use `db:analyze` before `db:fix-refs-prod`**
4. **Double-check MongoDB URIs**
5. **Verify script parameters before execution**

## 📝 Common Workflows

### Fix Trip Date Issues
1. Identify the problem trip and correct start date
2. Run: `npm run trips:fix-days <tripId> <correctStartDate>`
3. Verify fix via API or CMS admin

### Import New Activities
1. Place CSV file in `assets/import-activity/`
2. Use CMS API endpoint: `/api/import-activities`
3. Or run: `npm run import:trips` for batch processing

### Database Health Check
1. Run: `npm run db:check` (local)
2. Or: `npm run db:analyze <prod-uri>` (production)
3. Review output for inconsistencies

### Fix Reference Issues
1. Run: `npm run db:analyze <uri>` to identify issues
2. Run: `npm run db:fix-refs-prod <uri>` to fix
3. Verify via: `npm run db:analyze <uri>` again 