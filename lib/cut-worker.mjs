// dsh-pet-luotianyi cut worker.
//
// Runs ONE background-removal job in a throwaway process. The cut-out engine
// (@imgly/background-removal-node -> onnxruntime) allocates ~1GB per call, which
// is fatal inside the DSH host process, so the work is isolated here: the spike
// dies with this process and a native crash can never take DSH down.
//
// Usage: <node|electron-as-node> cut-worker.mjs <jobDir>
//   <jobDir>/job.json  { params, config }
//   <jobDir>/input.bin source image bytes
// -> <jobDir>/out.png   result sprite
//    <jobDir>/result.json { ok, ...stats } | { ok:false, error }
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadEngine, loadSharp, processImage } from './pet-host.js'

const dir = process.argv[2]
function fail(message) {
  try { writeFileSync(join(dir, 'result.json'), JSON.stringify({ ok: false, error: String(message) }), 'utf8') } catch (_) { /* ignore */ }
  process.exit(1)
}
if (!dir) fail('cut-worker: missing job dir')

try {
  const job = JSON.parse(readFileSync(join(dir, 'job.json'), 'utf8'))
  const sourceBuffer = readFileSync(join(dir, 'input.bin'))
  const params = job.params || {}

  const engine = await loadEngine(job.config || {})
  if (!engine) fail('未安装抠图引擎（@imgly/background-removal-node）')
  const sharp = await loadSharp(engine.nodeModules)

  // An installed build may ship fewer models than the UI offers (this one has no
  // "large"), so clamp to a model the engine can actually load instead of failing
  // with "Resource /models/large not found".
  const available = engine.models || []
  let model = params.model
  let modelFallback = false
  if (available.length && available.indexOf(model) < 0) {
    model = available.indexOf('medium') >= 0 ? 'medium' : available[0]
    modelFallback = true
  }

  const out = await processImage({
    sharp,
    removeBackground: engine.removeBackground,
    publicPath: engine.publicPath,
    sourceBuffer,
    model,
    crop: params.crop,
    threshold: params.threshold,
    feather: params.feather,
    pad: params.pad,
    size: params.size,
  })

  writeFileSync(join(dir, 'out.png'), out.png)
  writeFileSync(join(dir, 'result.json'), JSON.stringify({
    ok: true,
    model,
    modelFallback,
    availableModels: available,
    width: out.width,
    height: out.height,
    sourceWidth: out.sourceWidth,
    sourceHeight: out.sourceHeight,
    opaqueRatio: out.opaqueRatio,
    bytes: out.png.length,
  }), 'utf8')
  process.exit(0)   // force exit: onnxruntime keeps threads alive otherwise
} catch (e) {
  fail((e && e.message) || e)
}
