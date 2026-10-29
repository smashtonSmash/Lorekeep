// Bundles LoreKeep into one self-contained HTML file (no CDN, no assets).
//  dist/index.html    – a normal web page (GitHub Pages, any static host)
//  dist/artifact.html – the same app as claude.ai artifact content (shared-table mode)
import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const r = await build({
  entryPoints: ['src/main.tsx'], bundle: true, write: false, minify: true, format: 'iife', target: 'es2020',
  jsx: 'automatic', loader: { '.json': 'json', '.jpg': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' },
  outdir: 'dist', nodePaths: [process.env.NODE_DEPS ?? 'node_modules'], legalComments: 'none',
})
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script')
const css = r.outputFiles.find((f) => f.path.endsWith('.css')).text
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:wght@400;500;700;800&display=swap">'
const head = `<title>LoreKeep</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="theme-color" content="#15110e">\n${fonts}\n<style>${css}</style>`
const body = `<div id="root"></div>\n<script>${js}</script>`
mkdirSync('dist', { recursive: true })
writeFileSync('dist/artifact.html', `${head}\n${body}\n`)
writeFileSync('dist/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="LoreKeep"><link rel="icon" type="image/png" href="icon-32.png"><link rel="apple-touch-icon" href="icon-180.png"><link rel="manifest" href="manifest.webmanifest">${head}</head><body>${body}</body></html>\n`)
if (existsSync('public')) cpSync('public', 'dist', { recursive: true })
console.log('built', (readFileSync('dist/index.html').length / 1024).toFixed(0) + ' KB')
