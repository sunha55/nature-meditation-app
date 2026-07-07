import {
  bowlSizes,
  buildBowlEnsemble,
  getIntervalRange,
  getPatternWeights,
} from '../data/singingbowl.js'
import { ensureAudioReady, getBowlGain } from './audio.js'

const BOWL_BOOST = 1.6

let bowlTimers = []
let bowlNodes = []
let mixAmount = 0
let muted = false
let isRunning = false
let sessionContext = null
let fullEnsemble = []
let basePatternWeights = {}
let baseIntervalRange = { min: 28, max: 48 }
let mixProfile = { active: false }

function trackNode(node) {
  bowlNodes.push(node)
}

function trackTimer(cancel) {
  bowlTimers.push(cancel)
}

function computeMixProfile(amount) {
  if (amount <= 0) {
    return { active: false, outputGain: 0, richness: 0, ensembleCount: 0, followUpChance: 0, introLevel: 0 }
  }

  const richness = amount ** 1.35

  return {
    active: true,
    outputGain: 0.38 + amount * 0.62,
    richness,
    ensembleCount: Math.max(1, Math.ceil(richness * fullEnsemble.length)),
    followUpChance: richness * 0.24,
    introLevel: richness,
  }
}

function getScaledPatternWeights(amount) {
  if (amount < 0.12) return { single: 1 }
  if (amount < 0.28) return { single: 0.72, echo: 0.28 }
  if (amount < 0.45) return { single: 0.42, overlap: 0.33, echo: 0.25 }
  if (amount < 0.65) {
    return {
      single: 0.24,
      overlap: 0.28,
      cascade: 0.18,
      cluster: 0.16,
      echo: 0.14,
    }
  }
  return basePatternWeights
}

function getScaledIntervalRange(amount) {
  const spread = baseIntervalRange.max - baseIntervalRange.min
  const maxGap = baseIntervalRange.max + spread * 1.6
  const minGap = baseIntervalRange.min
  return {
    min: maxGap - (maxGap - minGap) * amount,
    max: baseIntervalRange.max + spread * 0.8 - (spread * 0.8 + baseIntervalRange.max - minGap) * amount,
  }
}

function getBowlPool() {
  if (!fullEnsemble.length) return []
  const count = mixProfile.ensembleCount ?? 1
  if (count >= fullEnsemble.length) return fullEnsemble

  const sorted = [...fullEnsemble].sort((a, b) => a.freq - b.freq)
  const picked = []
  const step = (sorted.length - 1) / Math.max(1, count - 1)
  for (let i = 0; i < count; i += 1) {
    picked.push(sorted[Math.min(sorted.length - 1, Math.round(i * step))])
  }
  return picked
}

function pickWeighted(weights) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = Math.random() * total
  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) return key
  }
  return entries[0][0]
}

function pickBowl(pool) {
  if (!pool.length) return null
  const totalGain = pool.reduce((sum, bowl) => sum + bowl.gain, 0)
  let roll = Math.random() * totalGain
  for (const bowl of pool) {
    roll -= bowl.gain
    if (roll <= 0) return bowl
  }
  return pool[pool.length - 1]
}

function pickDistinctBowls(count, pool) {
  const sorted = [...pool].sort((a, b) => a.freq - b.freq)
  if (count >= sorted.length) return sorted

  const picked = []
  const step = Math.max(1, Math.floor(sorted.length / count))
  let index = Math.floor(Math.random() * step)
  while (picked.length < count && index < sorted.length) {
    picked.push(sorted[index])
    index += step + Math.floor(Math.random() * 2)
  }

  while (picked.length < count) {
    const candidate = pickBowl(pool)
    if (candidate && !picked.includes(candidate)) picked.push(candidate)
  }

  return picked.slice(0, count)
}

function createNoiseBuffer(ctx, duration) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function playBowlStrike(ctx, output, bowl, time, intensity = 1) {
  if (!mixProfile.active) return

  const profile = bowlSizes[bowl.size] ?? bowlSizes.medium
  const strikeVolume = mixProfile.outputGain * bowl.gain * profile.volumeScale * intensity
  const detune = profile.detune[0] + Math.random() * (profile.detune[1] - profile.detune[0])

  const click = ctx.createBufferSource()
  click.buffer = createNoiseBuffer(ctx, 0.02 + Math.random() * 0.02)
  const clickFilter = ctx.createBiquadFilter()
  clickFilter.type = 'bandpass'
  clickFilter.frequency.value = profile.clickFreq + bowl.freq * 0.35
  clickFilter.Q.value = 0.9 + Math.random() * 0.8
  const clickGain = ctx.createGain()
  clickGain.gain.setValueAtTime(0, time)
  clickGain.gain.linearRampToValueAtTime(strikeVolume * profile.clickMix, time + 0.003)
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035)
  click.connect(clickFilter)
  clickFilter.connect(clickGain)
  clickGain.connect(output)
  click.start(time)
  click.stop(time + 0.05)

  profile.partials.forEach(({ mult, amp, decay }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const baseFreq = bowl.freq * mult
    osc.frequency.setValueAtTime(baseFreq, time)
    osc.detune.value = detune
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (0.996 + Math.random() * 0.002), time + decay)
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(strikeVolume * amp * 0.13, time + 0.01 + Math.random() * 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
    osc.connect(gain)
    gain.connect(output)
    osc.start(time)
    osc.stop(time + decay + 0.08)
    trackNode(osc)
  })
}

function playPattern(ctx, output, patternName, time, pool, intensity = 1) {
  if (!pool.length || !mixProfile.active) return

  if (patternName === 'single') {
    const bowl = pickBowl(pool)
    if (bowl) playBowlStrike(ctx, output, bowl, time, intensity)
    return
  }

  if (patternName === 'overlap' && pool.length > 1) {
    const first = pickBowl(pool)
    const second = pickBowl(pool.filter((bowl) => Math.abs(bowl.freq - first.freq) > 20))
    if (first) playBowlStrike(ctx, output, first, time, intensity * 0.95)
    if (second) playBowlStrike(ctx, output, second, time + 0.1 + Math.random() * 0.32, intensity * 0.82)
    return
  }

  if (patternName === 'cascade') {
    const bowlCount = Math.min(pool.length, mixAmount < 0.45 ? 2 : 3 + Math.floor(Math.random() * 2))
    const bowls = pickDistinctBowls(bowlCount, pool).sort((a, b) => a.freq - b.freq)
    bowls.forEach((bowl, index) => {
      const offset = index * (0.14 + Math.random() * 0.16)
      playBowlStrike(ctx, output, bowl, time + offset, intensity * (0.9 - index * 0.08))
    })
    return
  }

  if (patternName === 'cluster' && pool.length > 1) {
    const bowlCount = Math.min(pool.length, mixAmount < 0.65 ? 2 : 2 + Math.floor(Math.random() * 2))
    const bowls = pickDistinctBowls(bowlCount, pool)
    bowls.forEach((bowl, index) => {
      playBowlStrike(ctx, output, bowl, time + index * (0.02 + Math.random() * 0.04), intensity * 0.78)
    })
    return
  }

  if (patternName === 'echo') {
    const bowl = pickBowl(pool)
    if (!bowl) return
    playBowlStrike(ctx, output, bowl, time, intensity * 0.92)
    playBowlStrike(ctx, output, bowl, time + 1.4 + Math.random() * 1.8, intensity * 0.48)
  }
}

function playIntro(ctx, output) {
  const pool = getBowlPool()
  const level = mixProfile.introLevel

  if (level < 0.12) return

  if (level < 0.35) {
    playPattern(ctx, output, 'single', ctx.currentTime + 0.8, pool, 0.75)
    return
  }

  if (level < 0.65) {
    playPattern(ctx, output, 'overlap', ctx.currentTime + 0.7, pool, 0.8)
    return
  }

  playPattern(ctx, output, 'cluster', ctx.currentTime + 0.7, pool, 0.82)
  const introTimeout = setTimeout(() => {
    if (isRunning && !muted && mixProfile.active) {
      playPattern(ctx, output, 'cascade', ctx.currentTime, getBowlPool(), 0.68)
    }
  }, 2200)
  trackTimer(() => clearTimeout(introTimeout))
}

function scheduleBowlEvents(ctx, output) {
  let cancelled = false
  let timeoutId = null

  const schedule = () => {
    if (cancelled || !mixProfile.active) return

    const interval = getScaledIntervalRange(mixAmount)
    const delay = interval.min + Math.random() * (interval.max - interval.min)
    timeoutId = setTimeout(() => {
      if (cancelled || !mixProfile.active) {
        if (!cancelled && mixProfile.active) schedule()
        return
      }

      if (!muted) {
        const pool = getBowlPool()
        const pattern = pickWeighted(getScaledPatternWeights(mixAmount))
        playPattern(ctx, output, pattern, ctx.currentTime, pool)

        if (Math.random() < mixProfile.followUpChance) {
          const followUp = pickWeighted(
            mixAmount < 0.55
              ? { single: 0.45, overlap: 0.35, echo: 0.2 }
              : { overlap: 0.35, cascade: 0.35, single: 0.3 },
          )
          playPattern(ctx, output, followUp, ctx.currentTime + 2.5 + Math.random() * 3.5, pool, 0.72)
        }
      }

      schedule()
    }, delay * 1000)
  }

  playIntro(ctx, output)
  schedule()

  trackTimer(() => {
    cancelled = true
    clearTimeout(timeoutId)
  })
}

function applyMixAmount(amount) {
  mixAmount = Math.max(0, Math.min(1, amount))
  mixProfile = computeMixProfile(mixAmount)

  if (!mixProfile.active) {
    if (getBowlGain()) getBowlGain().gain.value = 0
    return
  }

  if (!muted && getBowlGain()) {
    getBowlGain().gain.value = mixProfile.outputGain * BOWL_BOOST
  }
}

function startEngine(context) {
  ensureAudioReady().then((audioCtx) => {
    if (!isRunning) return

    fullEnsemble = buildBowlEnsemble(context.track, context.themeId)
    basePatternWeights = getPatternWeights(context.track)
    baseIntervalRange = getIntervalRange(context.track)
    applyMixAmount(mixAmount)
    scheduleBowlEvents(audioCtx, getBowlGain())
  })
}

export async function startSingingBowl(amount = 0.45, context = {}) {
  stopSingingBowl()
  sessionContext = context
  mixAmount = amount
  muted = false

  if (amount <= 0) {
    mixProfile = computeMixProfile(0)
    if (getBowlGain()) getBowlGain().gain.value = 0
    return
  }

  isRunning = true
  await ensureAudioReady()
  startEngine(context)
}

export function setSingingBowlVolume(amount, context = null) {
  if (context) sessionContext = context

  const prevAmount = mixAmount
  applyMixAmount(amount)

  if (amount <= 0) {
    if (isRunning) stopSingingBowl()
    return
  }

  if (!isRunning && sessionContext) {
    isRunning = true
    muted = false
    startEngine(sessionContext)
    return
  }

  if (isRunning && prevAmount <= 0 && amount > 0) {
    startEngine(sessionContext)
  }
}

export function pauseSingingBowl() {
  muted = true
  if (getBowlGain()) getBowlGain().gain.value = 0
}

export function resumeSingingBowl() {
  muted = false
  applyMixAmount(mixAmount)
}

export function stopSingingBowl() {
  isRunning = false
  bowlTimers.forEach((cancel) => cancel())
  bowlTimers = []
  bowlNodes.forEach((node) => {
    try {
      node.stop?.()
    } catch {
      // already stopped
    }
  })
  bowlNodes = []
  fullEnsemble = []
  mixProfile = computeMixProfile(0)
}
