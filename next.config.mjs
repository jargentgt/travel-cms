import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  output: 'standalone', // Required for Docker deployment
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Configure upload size limits for Railway
  experimental: {
    // Enable larger file uploads
    serverComponentsExternalPackages: [],
  },
  // Increase body size limit for file uploads
  serverRuntimeConfig: {
    // Increase the file upload size limit to 50MB
    bodyParser: {
      sizeLimit: '50mb',
    },
  },

  webpack: (webpackConfig) => {
    webpackConfig.experiments = {
      ...webpackConfig.experiments,
      topLevelAwait: true,
    }
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.mjs': ['.mts', '.mjs'],
      '.js': ['.ts', '.tsx', '.jsx', '.js'],
    }

    return webpackConfig
  },
}

export default nextConfig
