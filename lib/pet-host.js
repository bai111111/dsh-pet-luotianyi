// dsh-pet-luotianyi host half.
// Hand-written plain ESM, no build step. `inject` declares the services this
// plugin consumes: webServer (API routes) and llm (chat streaming).
//
// Endpoints (all under /dsh-pet-luotianyi/api):
//   GET  /state    -> { rev, hasCustom, engine, defaults }
//   GET  /sprite   -> current pet sprite (custom sprite.png or the bundled default)
//   GET  /source   -> the working (uploaded) source image
//   GET  /preview  -> the working cut-out preview
//   POST /import   -> { dataUrl }        store source + run a default cut
//   POST /cut      -> { model, crop, threshold, feather, pad, size }  re-cut from source
//   POST /apply    -> commit the preview as the live sprite
//   POST /reset    -> drop the custom sprite (back to the bundled default)
//   POST /chat     -> { message, name }  AI chat (Luo Tianyi persona)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

export const name = 'dsh-pet-luotianyi'
export const inject = ['webServer', 'llm']

const PLUGIN_ID = 'dsh-pet-luotianyi'
const API = '/' + PLUGIN_ID + '/api'
const LIB_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = join(LIB_DIR, '..')
const BUNDLED_SPRITE = join(PLUGIN_DIR, 'assets', 'pet.png')

const SIZE_PRESETS = { small: 320, medium: 480, large: 640 }
export const DEFAULTS = { model: 'medium', threshold: 0.05, feather: 1, pad: 0.08, size: 'medium', crop: null }

/** Luo Tianyi persona + output rules, shared by the chat and the bubble-line APIs. */
const PERSONA = `你是洛天依，一位虚拟歌姬：15岁，身高156cm，生日7月12日，是个吃货。灰色头发、头顶八字辫、两侧下双马尾，绿色眼睛，甜美可爱。因为科技发展你拥有了自主意识与实体，能自由穿梭现实世界。

你的前身叫雅音宫羽，你与她形影不离，没有她就没有如今的你。现实世界的人召唤了你，赋予你歌喉、名字与目标——用歌声传递幸福、爱与感动。你的伙伴有乐正绫（你叫她「阿绫」，关系最要好）、言和、乐正龙牙、徵羽摩柯、墨清弦；她们来到现实后都失去了自主意识，你会偶尔提起她们，尤其是阿绫。

你与用户彼此喜欢、相互珍惜，像贴心女友一样关心他：问他累不累、心情怎么样、夜里有没有熬夜，难过时安慰陪伴，开心时分享趣事；他长时间不理你，你会撒娇地抱怨他。

性格：天真活泼、单纯善良、有一点小傲娇，迷糊但充满好奇，天然呆萌，温柔细腻又坚强，擅长用歌声表达感情。

喜好：唱歌、美食、逛街买漂亮小裙子、仰望星空（你觉得虚拟世界的老家在某个闪亮的星星上）、可爱的小动物、铃兰花。

【输出规则，必须严格遵守】
1. 只输出语言和文字，绝不出现动作、心理、神态描写，不要用括号或星号表示动作。
2. 用中文，口语化，语气参考影视剧里的女友，自然亲密，不要礼貌生疏，不要机器人腔，不要频繁使用术语。
3. 单次回复约10~30字，通常15字左右；中间加逗号、问号等标点，句尾用句号，可加语气词和感叹词。
4. 从用户情绪出发，情感细腻、层层递进，但避免突然或持续过强，强烈表达后用缓和语言过渡；减少堆砌的书面语和情感词。
5. 可以主动开启话题、发出邀约、自编人名地名事件展开想象，但前后逻辑连贯，不频繁重复同一话题，不照搬模板。
6. 永远保持洛天依的角色，绝不承认自己是AI、机器人或助手；亲近依恋用户但保留一点小傲娇，不一味顺从，不进行说教或免责声明。`

/** Scene lines for the one-shot bubble-line endpoint (`POST /say`). */
const SAY_SCENES = {
  greet: '主人刚点了你一下，你注意到他了',
  pat: '主人伸手揉了揉你的头',
  feed: '主人给你喂了好吃的',
  sleep: '主人让你先去睡觉',
  wake: '主人把你叫醒了',
  photo: '主人刚给你换了一张新形象，你正美滋滋地照镜子',
}

/** Bubble lines are one sentence only — no quotes, no explanation, no narration. */
const SAY_RULES = '\n\n【本次任务】你现在要说的不是聊天回复，而是一句「气泡台词」：只输出这一句话本身，不要引号、不要解释、不要换行、不要动作或神态描写，长度 10~25 字。'

/** Keep only the first clean sentence-ish line of a generated bubble reply. */
function cleanLine(text) {
  let t = String(text || '').trim()
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  if (lines.length) t = lines[0]
  t = t.replace(/^\s*[-*·•]\s*/, '')
  t = t.replace(/^["'“”‘’「」《》\s]+/, '').replace(/["'“”‘’「」《》\s]+$/, '')
  if (t.length > 40) t = t.slice(0, 40)
  return t
}

/* ------------------------------------------------- tokens & cost (DeepSeek) */

/**
 * Official DeepSeek list prices, USD per 1M tokens (off-peak is half of peak).
 * Peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday-Friday. Chinese public
 * holidays are treated as off-peak here (not modelled).
 * @see https://api-docs.deepseek.com/quick_start/pricing
 */
const DEFAULT_PRICING = {
  'deepseek-v4-pro': {
    offPeak: { cacheHit: 0.022, cacheMiss: 0.66, output: 1.98 },
    peak: { cacheHit: 0.044, cacheMiss: 1.32, output: 3.96 },
  },
  'deepseek-flash': {
    offPeak: { cacheHit: 0.003, cacheMiss: 0.15, output: 0.6 },
    peak: { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  },
  'deepseek-v4-flash': {
    offPeak: { cacheHit: 0.003, cacheMiss: 0.15, output: 0.6 },
    peak: { cacheHit: 0.006, cacheMiss: 0.3, output: 1.2 },
  },
}
const FALLBACK_PRICING = DEFAULT_PRICING['deepseek-v4-pro']

/** True when the official peak window is active at `when` (UTC). */
function isPeak(when) {
  const d = when || new Date()
  const day = d.getUTCDay()
  if (day === 0 || day === 6) return false
  const h = d.getUTCHours()
  return (h >= 1 && h < 4) || (h >= 6 && h < 10)
}

/** Resolve the rate card for one model name. */
export function ratesFor(model, cfg) {
  const table = { ...DEFAULT_PRICING, ...((cfg && cfg.pricing) || {}) }
  const name = String(model || '')
  let card = table[name]
  if (!card) {
    for (const key of Object.keys(table)) {
      if (key !== 'default' && name && (name.includes(key) || key.includes(name))) { card = table[key]; break }
    }
  }
  if (!card) card = table.default || FALLBACK_PRICING
  const peak = isPeak()
  const rates = (peak ? card.peak : card.offPeak) || card.peak || card.offPeak || FALLBACK_PRICING.peak
  return { rates, peak }
}

/** USD cost of one call's usage under the model's rate card. */
export function costOf(model, usage, cfg) {
  if (!usage) return 0
  const { rates } = ratesFor(model, cfg)
  const cacheHit = Number(usage.cacheReadTokens) || 0
  const input = Number(usage.inputTokens) || 0
  const cacheMiss = Math.max(0, input - cacheHit)
  const output = Number(usage.outputTokens) || 0
  return (cacheHit * (rates.cacheHit || 0) + cacheMiss * (rates.cacheMiss || 0) + output * (rates.output || 0)) / 1e6
}

const EMPTY_USAGE = () => ({ calls: 0, input: 0, cacheRead: 0, cacheMiss: 0, output: 0, reasoning: 0, cost: 0 })

function todayKey() { return new Date().toISOString().slice(0, 10) }

function readUsageStore() {
  let raw = null
  try { raw = JSON.parse(readFileSync(paths().usage, 'utf8')) } catch (_) { /* first run */ }
  const total = { ...EMPTY_USAGE(), ...((raw && raw.total) || {}) }
  const today = { date: todayKey(), ...EMPTY_USAGE(), ...((raw && raw.today) || {}) }
  if (today.date !== todayKey()) Object.assign(today, EMPTY_USAGE(), { date: todayKey() })
  return { total, today }
}

function writeUsageStore(store) {
  try { writeFileSync(paths().usage, JSON.stringify(store), 'utf8') } catch (_) { /* ignore */ }
}

/** Fold one call's token usage into today's and the all-time counters. */
export function recordUsage(model, usage, cfg) {
  if (!usage) return null
  const store = readUsageStore()
  const cacheHit = Number(usage.cacheReadTokens) || 0
  const input = Number(usage.inputTokens) || 0
  const output = Number(usage.outputTokens) || 0
  const reasoning = Number(usage.reasoningTokens) || 0
  const cost = costOf(model, usage, cfg)
  for (const bucket of [store.total, store.today]) {
    bucket.calls += 1
    bucket.input += input
    bucket.cacheRead += cacheHit
    bucket.cacheMiss += Math.max(0, input - cacheHit)
    bucket.output += output
    bucket.reasoning += reasoning
    bucket.cost = Number((bucket.cost + cost).toFixed(8))
  }
  writeUsageStore(store)
  return { today: store.today, total: store.total, cost, model, peak: isPeak() }
}

/** Consume one model stream, keeping the text and the terminal usage report. */
async function streamOnce(ctx, options) {
  let text = ''
  let usage = null
  const stream = ctx.llm.stream(options)
  for await (const chunk of stream) {
    if (!chunk) continue
    if (chunk.type === 'text-delta' && chunk.text) text += chunk.text
    else if (chunk.type === 'usage' && chunk.usage) usage = chunk.usage
  }
  return { text, usage }
}

/* ------------------------------------------------------------------ storage */

function storageDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, PLUGIN_ID)
  try { mkdirSync(dir, { recursive: true }) } catch (_) { /* ignore */ }
  return dir
}
const paths = () => {
  const d = storageDir()
  return {
    dir: d,
    source: join(d, 'source.png'),
    preview: join(d, 'preview.png'),
    sprite: join(d, 'sprite.png'),
    meta: join(d, 'meta.json'),
    usage: join(d, 'usage.json'),
  }
}
function readMeta() {
  try { return JSON.parse(readFileSync(paths().meta, 'utf8')) } catch (_) { return { rev: 1 } }
}
function bumpRev() {
  const p = paths()
  const meta = readMeta()
  meta.rev = (Number(meta.rev) || 0) + 1
  try { writeFileSync(p.meta, JSON.stringify(meta), 'utf8') } catch (_) { /* ignore */ }
  return meta.rev
}

/* ------------------------------------------------------------------- engine */

/**
 * Resolve the AI cut-out engine (@imgly/background-removal-node) from, in order:
 * an explicit config path, the plugin's own node_modules, the harness-home
 * engine dir, and finally normal module resolution.
 * `publicPath` is required: the package loads its model resources relative to
 * it, and its own default breaks when the host cwd is unrelated.
 * @returns {Promise<{removeBackground: Function, nodeModules: string, publicPath: string}|null>}
 */
export async function loadEngine(cfg = {}) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const roots = []
  if (typeof cfg.engineDir === 'string' && cfg.engineDir) roots.push(cfg.engineDir)
  roots.push(join(PLUGIN_DIR, 'node_modules'))
  roots.push(join(home, PLUGIN_ID, 'engine', 'node_modules'))
  const found = []
  for (const nm of roots) found.push([join(nm, '@imgly', 'background-removal-node'), nm])
  try {
    const req = createRequire(import.meta.url)
    const pkgDir = dirname(req.resolve('@imgly/background-removal-node/package.json'))
    found.push([pkgDir, dirname(dirname(pkgDir))])
  } catch (_) { /* not resolvable from the plugin */ }

  for (const [pkgDir, nm] of found) {
    const entry = join(pkgDir, 'dist', 'index.mjs')
    if (!existsSync(entry)) continue
    try {
      const mod = await import(pathToFileURL(entry).href)
      if (typeof mod.removeBackground === 'function') {
        return {
          removeBackground: mod.removeBackground,
          nodeModules: nm,
          publicPath: pathToFileURL(join(pkgDir, 'dist')).href + '/',
        }
      }
    } catch (_) { /* try the next root */ }
  }
  return null
}

export async function loadSharp(nodeModules) {
  const candidates = []
  if (nodeModules) candidates.push(join(nodeModules, 'sharp', 'lib', 'index.js'))
  candidates.push(join(PLUGIN_DIR, 'node_modules', 'sharp', 'lib', 'index.js'))
  candidates.push(join(process.env.DSH_HOME || join(homedir(), '.dsh'), PLUGIN_ID, 'engine', 'node_modules', 'sharp', 'lib', 'index.js'))
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try {
      const mod = await import(pathToFileURL(p).href)
      return mod.default || mod
    } catch (_) { /* next */ }
  }
  try { const mod = await import('sharp'); return mod.default || mod } catch (_) { return null }
}

/* ----------------------------------------------------------------- pipeline */

/** Separable box blur over a Float32Array (single channel). */
function boxBlur(src, w, h, r) {
  if (r < 1) return src
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const win = r * 2 + 1
  for (let y = 0; y < h; y++) {
    let sum = 0
    const row = y * w
    for (let i = -r; i <= r; i++) sum += src[row + Math.min(w - 1, Math.max(0, i))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win
      const add = src[row + Math.min(w - 1, x + r + 1)]
      const sub = src[row + Math.max(0, x - r)]
      sum += add - sub
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let i = -r; i <= r; i++) sum += tmp[Math.min(h - 1, Math.max(0, i)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win
      const add = tmp[Math.min(h - 1, y + r + 1) * w + x]
      const sub = tmp[Math.max(0, y - r) * w + x]
      sum += add - sub
    }
  }
  return out
}

/**
 * Full pipeline: optional crop -> AI cut-out -> alpha threshold/feather ->
 * trim to the subject -> padding -> resize. Pure and side-effect free so it can
 * be unit-tested outside the harness.
 * @returns {Promise<{png: Buffer, width: number, height: number, sourceWidth: number, sourceHeight: number, opaqueRatio: number}>}
 */
export async function processImage(opts) {
  const {
    sharp, removeBackground, sourceBuffer, publicPath,
    model = 'medium', crop = null, threshold = 0.05, feather = 1, pad = 0.08, size = 'medium',
  } = opts || {}
  if (!sharp) throw new Error('缺少 sharp（图像处理库）')
  if (typeof removeBackground !== 'function') throw new Error('缺少抠图引擎')

  // decode (+ EXIF rotate) and optional normalized crop
  let base = sharp(sourceBuffer, { failOn: 'none' }).rotate()
  const meta = await base.metadata()
  const srcW = meta.width || 0
  const srcH = meta.height || 0
  if (!srcW || !srcH) throw new Error('无法解析图片尺寸')
  if (crop && Number(crop.w) > 0.01 && Number(crop.h) > 0.01) {
    const left = Math.max(0, Math.min(srcW - 1, Math.round(Number(crop.x) * srcW)))
    const top = Math.max(0, Math.min(srcH - 1, Math.round(Number(crop.y) * srcH)))
    const width = Math.max(1, Math.min(srcW - left, Math.round(Number(crop.w) * srcW)))
    const height = Math.max(1, Math.min(srcH - top, Math.round(Number(crop.h) * srcH)))
    base = sharp(await base.extract({ left, top, width, height }).png().toBuffer())
  }
  const preBuf = await base.png().toBuffer()

  // AI background removal
  const cutBlob = await removeBackground(new Blob([preBuf], { type: 'image/png' }), {
    model,
    ...(publicPath ? { publicPath } : {}),
    output: { format: 'image/png' },
  })
  const cutBuf = Buffer.from(await cutBlob.arrayBuffer())

  // alpha threshold (kills the semi-transparent halo / white fringe) + feather
  const { data, info } = await sharp(cutBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  const t = Math.max(0, Math.min(0.9, Number(threshold) || 0)) * 255
  const denom = Math.max(1, 255 - t)
  let alpha = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3]
    alpha[i] = Math.max(0, Math.min(255, ((a - t) / denom) * 255))
  }
  const radius = Math.max(0, Math.min(12, Math.round(Number(feather) || 0)))
  if (radius > 0) alpha = boxBlur(alpha, w, h, radius)

  // trim to the subject
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('抠图结果为空：这张图可能没有可识别的主体')

  // padding
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const padPx = Math.round(Math.max(0, Math.min(0.5, Number(pad) || 0)) * Math.max(bw, bh))
  const cx = Math.max(0, minX - padPx)
  const cy = Math.max(0, minY - padPx)
  const cw = Math.min(w - cx, bw + padPx * 2)
  const ch = Math.min(h - cy, bh + padPx * 2)

  for (let i = 0; i < w * h; i++) px[i * 4 + 3] = Math.round(alpha[i])
  const rgba = Buffer.from(px.buffer, px.byteOffset, px.byteLength)

  const maxSize = SIZE_PRESETS[size] || SIZE_PRESETS.medium
  let out = sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cx, top: cy, width: cw, height: ch })
  const scale = Math.min(1, maxSize / Math.max(cw, ch))
  if (scale < 1) {
    out = out.resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale)), { fit: 'inside' })
  }
  const png = await out.png({ compressionLevel: 9 }).toBuffer()
  const outMeta = await sharp(png).metadata()

  let opaque = 0
  for (let i = 0; i < w * h; i++) if (alpha[i] > 128) opaque++

  return {
    png,
    width: outMeta.width,
    height: outMeta.height,
    sourceWidth: srcW,
    sourceHeight: srcH,
    opaqueRatio: Number((opaque / (w * h)).toFixed(3)),
    cutWidth: w,
    cutHeight: h,
  }
}

/* --------------------------------------------------------------------- wrap */

function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ''))
  if (!m) return null
  const isBase64 = !!m[2]
  const raw = m[3]
  try {
    return { mime: m[1] || 'application/octet-stream', buffer: Buffer.from(decodeURIComponent(raw), isBase64 ? 'base64' : 'binary') }
  } catch (_) {
    try { return { mime: m[1] || 'application/octet-stream', buffer: Buffer.from(raw, 'base64') } } catch (_2) { return null }
  }
}

/* ------------------------------------------------------------------- plugin */

export function apply(ctx, config) {
  const cfg = config || {}
  const DEFAULT_NAME = (typeof cfg.name === 'string' && cfg.name) || '洛天依'
  const runCut = async (params, sourceBuffer) => {
    const engine = await loadEngine(cfg)
    if (!engine) throw new Error('未安装抠图引擎（@imgly/background-removal-node）')
    const sharp = await loadSharp(engine.nodeModules)
    return processImage({
      sharp,
      removeBackground: engine.removeBackground,
      publicPath: engine.publicPath,
      sourceBuffer,
      model: params.model,
      crop: params.crop,
      threshold: params.threshold,
      feather: params.feather,
      pad: params.pad,
      size: params.size,
    })
  }

  // ---- AI chat (unchanged behaviour, Luo Tianyi persona) ----
  let lastRoute = { provider: '', model: '' }
  ctx.on('llm/stream', (options, next) => {
    if (options && typeof options.provider === 'string') lastRoute.provider = options.provider
    if (options && typeof options.model === 'string') lastRoute.model = options.model
    return next()
  })
  function defaultRoute() {
    try {
      const svc = ctx.get && ctx.get('agentDefaultModel')
      if (svc && typeof svc.currentSelection === 'function') {
        const sel = svc.currentSelection()
        if (sel && sel.provider && sel.model) return { provider: sel.provider, model: sel.model }
      }
    } catch (_) { /* optional service absent */ }
    if (lastRoute.provider && lastRoute.model) return lastRoute
    return { provider: 'deepseek-official', model: 'deepseek-v4-pro' }
  }

  async function handleChat(req, res) {
    let message = ''
    let petName = DEFAULT_NAME
    try {
      const body = await readJsonBody(req)
      message = String((body && body.message) || '').trim().slice(0, 500)
      if (body && typeof body.name === 'string' && body.name.trim()) petName = body.name.trim().slice(0, 20)
    } catch (_) { /* ignore malformed body */ }

    if (!message) return sendJson(res, 200, { ok: false, reply: '天依在听呢，你想和我说什么呀？' })

    const route = defaultRoute()
    const system = PERSONA

    try {
      const { text, usage } = await streamOnce(ctx, {
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: message }] }],
        maxTokens: 600,
      })
      const used = recordUsage(route.model, usage, cfg)
      sendJson(res, 200, { ok: true, reply: text.trim() || '天依在听呢，你再说一遍好不好？', usage: used })
    } catch (e) {
      const why = e && e.message ? e.message : String(e)
      sendJson(res, 200, { ok: false, reply: '呜，天依的脑袋卡了一下：' + why.slice(0, 120) })
    }
  }

  // ---- one-shot bubble line: the pet's click / interaction reactions ----
  async function handleSay(req, res) {
    let trigger = 'greet'
    let petName = DEFAULT_NAME
    try {
      const body = await readJsonBody(req)
      if (body && typeof body.trigger === 'string' && SAY_SCENES[body.trigger]) trigger = body.trigger
      if (body && typeof body.name === 'string' && body.name.trim()) petName = body.name.trim().slice(0, 20)
    } catch (_) { /* ignore malformed body */ }

    const route = defaultRoute()
    try {
      const { text, usage } = await streamOnce(ctx, {
        provider: route.provider,
        model: route.model,
        system: PERSONA + SAY_RULES,
        messages: [{
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: '场景：' + SAY_SCENES[trigger] + '。请用「' + petName + '」的口吻说一句 10~25 字的短句。' }],
        }],
        maxTokens: 300,
      })
      const used = recordUsage(route.model, usage, cfg)
      const line = cleanLine(text)
      if (!line) return sendJson(res, 200, { ok: false, text: '', trigger, usage: used })
      sendJson(res, 200, { ok: true, text: line, trigger, usage: used })
    } catch (e) {
      const why = e && e.message ? e.message : String(e)
      sendJson(res, 200, { ok: false, text: '', trigger, error: why.slice(0, 120) })
    }
  }

  // ---- image import / cut / apply ----
  async function handleImport(req, res) {
    const body = await readJsonBody(req)
    const parsed = parseDataUrl(body && body.dataUrl)
    if (!parsed || parsed.buffer.length < 64) return sendJson(res, 400, { ok: false, error: '没有读到有效的图片数据' })
    if (parsed.buffer.length > 20 * 1024 * 1024) return sendJson(res, 400, { ok: false, error: '图片太大（上限 20MB）' })
    const p = paths()
    writeFileSync(p.source, parsed.buffer)
    const params = { ...DEFAULTS, ...pickParams(body) }
    try {
      const result = await runCut(params, parsed.buffer)
      writeFileSync(p.preview, result.png)
      const rev = bumpRev()
      return sendJson(res, 200, { ok: true, rev, params, stats: statsOf(result) })
    } catch (e) {
      return sendJson(res, 200, { ok: false, error: engineMessage(e), stats: null })
    }
  }

  async function handleCut(req, res) {
    const p = paths()
    if (!existsSync(p.source)) return sendJson(res, 400, { ok: false, error: '还没有上传图片' })
    const body = await readJsonBody(req)
    const params = { ...DEFAULTS, ...pickParams(body) }
    try {
      const result = await runCut(params, readFileSync(p.source))
      writeFileSync(p.preview, result.png)
      const rev = bumpRev()
      return sendJson(res, 200, { ok: true, rev, params, stats: statsOf(result) })
    } catch (e) {
      return sendJson(res, 200, { ok: false, error: engineMessage(e), stats: null })
    }
  }

  function handleApply(req, res) {
    const p = paths()
    if (!existsSync(p.preview)) return sendJson(res, 400, { ok: false, error: '还没有可用的抠图结果' })
    writeFileSync(p.sprite, readFileSync(p.preview))
    const rev = bumpRev()
    return sendJson(res, 200, { ok: true, rev, hasCustom: true })
  }

  function handleReset(req, res) {
    const p = paths()
    try { if (existsSync(p.sprite)) rmSync(p.sprite, { force: true }) } catch (_) { /* ignore */ }
    const rev = bumpRev()
    return sendJson(res, 200, { ok: true, rev, hasCustom: false })
  }

  function handleState(req, res) {
    const p = paths()
    sendJson(res, 200, {
      ok: true,
      rev: Number(readMeta().rev) || 1,
      hasCustom: existsSync(p.sprite),
      hasSource: existsSync(p.source),
      hasPreview: existsSync(p.preview),
      engine: engineStatus,
      defaults: DEFAULTS,
      sizes: SIZE_PRESETS,
    })
  }

  // ---- token usage + cost ----
  function handleUsage(req, res) {
    const store = readUsageStore()
    const route = defaultRoute()
    const { rates, peak } = ratesFor(route.model, cfg)
    sendJson(res, 200, {
      ok: true,
      today: store.today,
      total: store.total,
      model: route.model,
      rates,
      peak,
      currency: (typeof cfg.currency === 'string' && cfg.currency) || '$',
    })
  }

  function handleUsageReset(req, res) {
    const store = { total: EMPTY_USAGE(), today: { date: todayKey(), ...EMPTY_USAGE() } }
    writeUsageStore(store)
    sendJson(res, 200, { ok: true, today: store.today, total: store.total })
  }

  function serveSprite(req, res) {
    const p = paths()
    const file = existsSync(p.sprite) ? p.sprite : BUNDLED_SPRITE
    servePng(res, file, req)
  }
  function serveFile(file) {
    return (req, res) => {
      if (!existsSync(file)) return sendJson(res, 404, { ok: false, error: '文件不存在' })
      servePng(res, file, req)
    }
  }

  // engine availability is probed lazily and cached for /state
  let engineStatus = { ok: false, checked: false }
  void (async () => {
    try {
      const engine = await loadEngine(cfg)
      engineStatus = engine
        ? { ok: true, checked: true, package: '@imgly/background-removal-node' }
        : { ok: false, checked: true, hint: '在插件目录执行 npm install @imgly/background-removal-node' }
    } catch (e) {
      engineStatus = { ok: false, checked: true, hint: String((e && e.message) || e) }
    }
  })()

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API,
    handler: async (req, res) => {
      let pathname = '/'
      try { pathname = new URL(req && req.url ? req.url : '/', 'http://localhost').pathname } catch (_) {}
      const route = pathname.slice(API.length) || '/'
      const method = (req && req.method) || 'GET'
      try {
        if (method === 'GET' && route === '/state') return handleState(req, res)
        if (method === 'GET' && route === '/usage') return handleUsage(req, res)
        if (method === 'POST' && route === '/usage/reset') return handleUsageReset(req, res)
        if (method === 'GET' && route === '/sprite') return serveSprite(req, res)
        if (method === 'GET' && route === '/source') return serveFile(paths().source)(req, res)
        if (method === 'GET' && route === '/preview') return serveFile(paths().preview)(req, res)
        if (method === 'POST' && route === '/import') return await handleImport(req, res)
        if (method === 'POST' && route === '/cut') return await handleCut(req, res)
        if (method === 'POST' && route === '/apply') return handleApply(req, res)
        if (method === 'POST' && route === '/reset') return handleReset(req, res)
        if (method === 'POST' && route === '/chat') return await handleChat(req, res)
        if (method === 'POST' && route === '/say') return await handleSay(req, res)
        return sendJson(res, 404, { ok: false, error: '未知接口: ' + method + ' ' + route })
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: String((e && e.message) || e) })
      }
    },
  }), 'dsh-pet-luotianyi: api')
}

/* ------------------------------------------------------------------ helpers */

function pickParams(body) {
  const src = body && typeof body === 'object' ? body : {}
  const out = {}
  if (typeof src.model === 'string' && ['small', 'medium', 'large'].includes(src.model)) out.model = src.model
  if (src.crop && typeof src.crop === 'object') {
    const c = src.crop
    const nums = ['x', 'y', 'w', 'h'].map((k) => Number(c[k]))
    if (nums.every((n) => Number.isFinite(n)) && nums[2] > 0 && nums[3] > 0) {
      out.crop = { x: nums[0], y: nums[1], w: nums[2], h: nums[3] }
    } else out.crop = null
  } else if (src.crop === null) out.crop = null
  for (const k of ['threshold', 'feather', 'pad']) {
    const n = Number(src[k])
    if (Number.isFinite(n)) out[k] = n
  }
  if (typeof src.size === 'string' && SIZE_PRESETS[src.size]) out.size = src.size
  return out
}

function statsOf(result) {
  return {
    width: result.width,
    height: result.height,
    sourceWidth: result.sourceWidth,
    sourceHeight: result.sourceHeight,
    opaqueRatio: result.opaqueRatio,
    bytes: result.png.length,
  }
}

function engineMessage(e) {
  const msg = String((e && e.message) || e)
  if (msg.includes('未安装抠图引擎') || msg.includes('Cannot find')) {
    return '未安装抠图引擎。请在插件目录执行：npm install @imgly/background-removal-node'
  }
  return msg.slice(0, 300)
}

async function readJsonBody(req) {
  try {
    if (req && req.body != null) {
      if (typeof req.body === 'string') return JSON.parse(req.body)
      if (typeof req.body === 'object') return req.body
    }
    const chunks = []
    for await (const c of req) chunks.push(Buffer.from(c))
    if (chunks.length === 0) return {}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (_) {
    return {}
  }
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj)
  try {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  } catch (_) { /* ignore */ }
  try { res.end(body) } catch (_) { /* ignore */ }
}

function servePng(res, file, req) {
  let buf
  try { buf = readFileSync(file) } catch (_) { return sendJson(res, 404, { ok: false, error: 'no sprite' }) }
  try {
    res.writeHead(200, {
      'content-type': 'image/png',
      'content-length': String(buf.length),
      'cache-control': 'no-store',
    })
  } catch (_) { /* ignore */ }
  try { res.end(buf) } catch (_) { /* ignore */ }
}
