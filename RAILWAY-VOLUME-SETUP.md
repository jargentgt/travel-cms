# Railway Volume Setup for Media Storage

## Overview

This guide explains how to configure Railway volumes for persistent media file storage with your Payload CMS application.

## Why Use Railway Volumes?

Railway's ephemeral filesystem means uploaded files are lost when your service restarts or redeploys. Volumes provide persistent storage that survives deployments.

## Configuration Steps

### 1. Create a Volume in Railway

1. Go to your Railway project dashboard
2. Navigate to your service settings
3. Click on "Volumes" tab
4. Click "New Volume"
5. Configure the volume:
   - **Mount Path**: `/app/uploads`
   - **Size**: Start with 1GB (can be increased later)
   - **Name**: `media-storage` (or any descriptive name)

### 2. Volume Path Configuration

The application is configured to use different paths based on environment:

- **Development (local)**: `public/media/`
- **Production (Railway)**: `/app/uploads/`

### 3. Environment Variables

Make sure these environment variables are set in Railway:

```bash
NODE_ENV=production
DATABASE_URI=your_mongodb_connection_string
PAYLOAD_SECRET=your_payload_secret
NEXT_PUBLIC_SERVER_URL=https://your-app.up.railway.app
CORS_ORIGINS=https://your-frontend-url.web.app,http://localhost:3001
```

### 4. Railway Service Configuration

Your `railway.toml` should include:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.railway"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

## File Access

Once configured, uploaded files will be:

- **Stored in**: `/app/uploads/` on Railway
- **Accessible via**: `https://your-app.up.railway.app/media/filename.webp`

## Volume Size Management

### Monitor Usage:
- Check Railway dashboard for volume usage
- Files are automatically optimized to WebP format (80% quality)
- Multiple image sizes generated (thumbnail, card, tablet)

### Resize Volume:
1. Go to Railway project → Service → Volumes
2. Click on your volume
3. Adjust size as needed
4. Volume will be resized without data loss

## Troubleshooting

### Files Not Persisting
1. Verify volume mount path is `/app/uploads`
2. Check that `NODE_ENV=production` in Railway
3. Ensure volume is attached to the correct service

### Files Not Accessible
1. Check that files are being uploaded to `/app/uploads`
2. Verify Railway service is serving static files
3. Check CORS configuration allows your frontend domain

### Volume Full
1. Increase volume size in Railway dashboard
2. Consider implementing file cleanup policies
3. Optimize image compression settings

## Alternative: S3 Storage

For larger scale applications, consider using S3-compatible storage:

- **Railway template**: Payload CMS with MinIO S3
- **External S3**: AWS S3, Cloudflare R2, etc.
- **Benefits**: Better for CDN, backup, scaling

## File Structure

```
/app/uploads/
├── original-filename.webp
├── original-filename-thumbnail.webp
├── original-filename-card.webp
└── original-filename-tablet.webp
```

## Security Notes

- Files are served directly by the application
- Consider adding authentication for sensitive files
- Volume data is persistent and backed up by Railway
- Use HTTPS for secure file transmission

## Cost Considerations

- Volume storage is charged per GB/month
- Unused space still incurs charges
- Monitor and optimize file sizes regularly
- Consider file retention policies for old uploads 