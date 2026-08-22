/// <reference types="bun-types" />

import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { injectManifest } from 'workbox-build'

const distDir = resolve(import.meta.dirname, '../dist')
const srcSw = resolve(import.meta.dirname, '../src/sw.ts')

async function generateServiceWorker() {
  if (!existsSync(distDir)) {
    console.error('Error: dist does not exist. Run build first.')
    process.exit(1)
  }

  console.log('Transpiling service worker...')
  const transpiled = await Bun.build({
    entrypoints: [srcSw],
    format: 'esm',
    target: 'browser',
    minify: false,
  })

  if (!transpiled.success) {
    console.error('Failed to transpile service worker:', transpiled.logs)
    process.exit(1)
  }

  const swJsContent = await transpiled.outputs[0].text()
  const tempSwPath = resolve(distDir, 'sw-src.js')
  writeFileSync(tempSwPath, swJsContent)

  console.log('Generating service worker with workbox...')

  try {
    const { count, size, warnings } = await injectManifest({
      swSrc: tempSwPath,
      swDest: resolve(distDir, 'sw.js'),
      globDirectory: distDir,
      globPatterns: ['**/*.{js,css,ico,png,svg,woff2,ttf,webmanifest}'],
      globIgnores: ['sw-src.js', 'sw.js'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    })

    unlinkSync(tempSwPath)

    if (warnings.length > 0) {
      console.warn('Warnings:', warnings.join('\n'))
    }

    console.log(
      `Service worker generated with ${count} files, totaling ${(size / 1024).toFixed(1)} KB`,
    )
  } catch (error) {
    console.error('Error generating service worker:', error)
    process.exit(1)
  }
}

generateServiceWorker()
