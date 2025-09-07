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
  // Configure external packages for server components
  serverExternalPackages: ['mongodb'],
  experimental: {
    // Enable larger file uploads - removed deprecated serverComponentsExternalPackages
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

    // Fix MongoDB AWS SDK dependency issues
    webpackConfig.resolve.fallback = {
      ...webpackConfig.resolve.fallback,
      'aws4': false,
      'aws-crt': false,
      '@aws-sdk/signature-v4-crt': false,
      '@aws-sdk/client-sso-oidc': false,
      'mongodb-client-encryption': false,
      'kerberos': false,
      'snappy': false,
    }

    // Ignore optional dependencies that cause warnings
    webpackConfig.ignoreWarnings = [
      { module: /aws4/ },
      { module: /@aws-sdk/ },
      { module: /mongodb-client-encryption/ },
      { module: /kerberos/ },
      { module: /snappy/ },
    ]

    return webpackConfig
  },
}

export default nextConfig
