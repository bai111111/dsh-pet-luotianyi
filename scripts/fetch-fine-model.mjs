#!/usr/bin/env node
// Download the fine-tier cut-out model (BRIA RMBG-2.0) and place it where
// dsh-pet-luotianyi looks for it: {DSH_HOME}/dsh-pet-luotianyi/models/rmbg-2.0.onnx
//
//   node scripts/fetch-fine-model.mjs
//
// Sources (tried in order):
//   1. huggingface.co  briaai/RMBG-2.0 onnx/model.onnx          (official fp32, ~176MB)
//   2. hf-mirror.com   briaai/RMBG-2.0 onnx/model.onnx
//   3. modelscope.cn   briaai/RMBG-2.0 onnx/model_fp16.onnx     (fp16, ~490MB)
//
// Newer exports carry ONNX IR version 10, which the bundled onnxruntime 1.17
// (IR ≤ 9) refuses; the script rewrites that header byte when needed.
import { existsSync, mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const TARGET = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-pet-luotianyi', 'models', 'rmbg-2.0.onnx')
const TMP = TARGET + '.download'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const SOURCES = [
  'https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model.onnx',
  'https://hf-mirror.com/briaai/RMBG-2.0/resolve/main/onnx/model.onnx',
  'https://modelscope.cn/models/briaai/RMBG-2.0/resolve/master/onnx/model_fp16.onnx',
]

if (existsSync(TARGET) && statSync(TARGET).size > 100 * 1048576) {
  console.log('fine model already installed:', TARGET, '(' + (statSync(TARGET).size / 1048576).toFixed(0) + 'MB)')
  process.exit(0)
}

mkdirSync(join(TARGET, '..'), { recursive: true })
let done = false
for (const url of SOURCES) {
  console.log('trying', url)
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' })
    console.log('  HTTP', r.status, r.headers.get('content-length') || '')
    if (!r.ok) continue
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 100 * 1048576) { console.log('  response too small (' + (buf.length / 1048576).toFixed(1) + 'MB), skipping'); continue }
    // newer exports: IR version 10 (bytes: 08 0A) -> rewrite to 9 (08 09) for ORT 1.17
    if (buf[0] === 0x08 && buf[1] === 0x0a) {
      buf[1] = 0x09
      console.log('  IR version 10 -> 9 (for the bundled onnxruntime)')
    } else if (!(buf[0] === 0x08)) {
      console.log('  unexpected header, skipping')
      continue
    }
    writeFileSync(TMP, buf)
    copyFileSync(TMP, TARGET)
    writeFileSync(TMP, Buffer.alloc(0))
    console.log('installed ->', TARGET, '(' + (buf.length / 1048576).toFixed(0) + 'MB)')
    done = true
    break
  } catch (e) {
    console.log('  ERR', String(e && e.message || e).slice(0, 80))
  }
}
if (!done) {
  console.error('FAILED: none of the mirrors worked. Download RMBG-2.0 onnx manually and put it at:\n  ' + TARGET)
  process.exit(1)
}
console.log('FINE MODEL READY — restart DSH, the 精细 tier will appear in the image panel.')
