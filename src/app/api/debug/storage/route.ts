import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface DiagnosticTest {
  success: boolean
  [key: string]: any
}

interface Diagnostics {
  timestamp: string
  environment: string | undefined
  uploadPaths: {
    production: string
    development: string
  }
  currentUploadPath: string
  tests: {
    directoryExists?: DiagnosticTest
    writePermissions?: DiagnosticTest
    directoryContents?: DiagnosticTest
    volumeMount?: DiagnosticTest
  }
  status?: string
}

export async function GET(request: NextRequest) {
  try {
    const diagnostics: Diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      uploadPaths: {
        production: '/app/uploads',
        development: 'public/media'
      },
      currentUploadPath: process.env.NODE_ENV === 'production' ? '/app/uploads' : 'public/media',
      tests: {}
    }

    // Test 1: Check if upload directory exists
    const uploadPath = diagnostics.currentUploadPath
    try {
      const stats = await fs.stat(uploadPath)
      diagnostics.tests.directoryExists = {
        success: true,
        isDirectory: stats.isDirectory(),
        path: uploadPath
      }
    } catch (error) {
      diagnostics.tests.directoryExists = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        path: uploadPath
      }
    }

    // Test 2: Check if directory is writable
    try {
      const testFile = path.join(uploadPath, `test-${Date.now()}.txt`)
      await fs.writeFile(testFile, 'Railway volume test file')
      await fs.unlink(testFile) // Clean up
      diagnostics.tests.writePermissions = {
        success: true,
        message: 'Directory is writable'
      }
    } catch (error) {
      diagnostics.tests.writePermissions = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    // Test 3: List directory contents
    try {
      const files = await fs.readdir(uploadPath)
      diagnostics.tests.directoryContents = {
        success: true,
        fileCount: files.length,
        files: files.slice(0, 10) // Show first 10 files
      }
    } catch (error) {
      diagnostics.tests.directoryContents = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    // Test 4: Check volume mount info (production only)
    if (process.env.NODE_ENV === 'production') {
      try {
        const mountInfo = await fs.readFile('/proc/mounts', 'utf8')
        const uploadMounts = mountInfo.split('\n').filter(line => line.includes('/app/uploads'))
        diagnostics.tests.volumeMount = {
          success: true,
          mounts: uploadMounts
        }
      } catch (error) {
        diagnostics.tests.volumeMount = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    // Overall status
    const allTestsPassed = Object.values(diagnostics.tests).every(test => test?.success)
    diagnostics.status = allTestsPassed ? 'healthy' : 'issues_detected'

    return NextResponse.json(diagnostics, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 