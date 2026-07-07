let audioContext = null
let masterGain = null
let natureGain = null
let musicGain = null
let bowlGain = null
let activeNodes = []

const VOLUME_BOOST = 2.2

function getContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    masterGain = audioContext.createGain()
    natureGain = audioContext.createGain()
    musicGain = audioContext.createGain()
    bowlGain = audioContext.createGain()
    natureGain.connect(masterGain)
    musicGain.connect(masterGain)
    bowlGain.connect(masterGain)
    masterGain.connect(audioContext.destination)
  }
  return audioContext
}

export function getMusicGain() {
  getContext()
  return musicGain
}

export function getBowlGain() {
  getContext()
  return bowlGain
}

export async function ensureAudioReady() {
  const ctx = getContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

function createNoiseBuffer(duration = 2) {
  const ctx = getContext()
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function createPinkNoiseBuffer(duration = 3) {
  const ctx = getContext()
  const length = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
    data[i] = pink
  }
  return buffer
}

function createRainLayer(ctx, output, { filterType, frequency, q = 0.7, gain, lfoRate, lfoDepth, filterLfo, playbackRate = 1 }) {
  const source = ctx.createBufferSource()
  source.buffer = createPinkNoiseBuffer(3)
  source.loop = true
  source.playbackRate.value = playbackRate

  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = frequency
  filter.Q.value = q

  const gainNode = ctx.createGain()
  gainNode.gain.value = gain

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(output)
  source.start()
  trackNode(source)

  if (lfoRate) {
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = lfoRate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = lfoDepth
    lfo.connect(lfoGain)
    lfoGain.connect(gainNode.gain)
    lfo.start()
    trackNode(lfo)
  }

  if (filterLfo) {
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = filterLfo.rate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = filterLfo.depth
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()
    trackNode(lfo)
  }
}

const rainProfiles = [
  { intensity: 0.72, speed: 0.55, drops: [0.22, 0.52], dropGain: 0.065, brightness: 1.15, gust: [9, 16] },
  { intensity: 0.9, speed: 0.82, drops: [0.1, 0.28], dropGain: 0.085, brightness: 0.98, gust: [6, 11] },
  { intensity: 0.62, speed: 0.48, drops: [0.35, 0.75], dropGain: 0.11, brightness: 1.2, gust: [11, 18] },
  { intensity: 0.95, speed: 0.95, drops: [0.08, 0.2], dropGain: 0.09, brightness: 0.92, gust: [5, 9] },
  { intensity: 0.58, speed: 0.42, drops: [0.4, 0.9], dropGain: 0.055, brightness: 1.08, gust: [12, 20] },
  { intensity: 0.86, speed: 0.78, drops: [0.12, 0.32], dropGain: 0.08, brightness: 1.0, gust: [7, 12] },
  { intensity: 0.68, speed: 0.5, drops: [0.28, 0.62], dropGain: 0.07, brightness: 0.88, gust: [10, 17] },
  { intensity: 0.92, speed: 1.08, drops: [0.06, 0.16], dropGain: 0.095, brightness: 1.05, gust: [4, 8] },
  { intensity: 1.05, speed: 0.88, drops: [0.05, 0.14], dropGain: 0.1, brightness: 0.85, gust: [5, 10] },
  { intensity: 0.74, speed: 0.62, drops: [0.18, 0.42], dropGain: 0.075, brightness: 1.12, gust: [8, 14] },
]

function playRainDrop(ctx, output, time, profile) {
  const drop = ctx.createBufferSource()
  drop.buffer = createNoiseBuffer(0.06 + Math.random() * 0.05)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 700 + Math.random() * 2800 * profile.brightness
  filter.Q.value = 0.8 + Math.random() * 1.4
  const gain = ctx.createGain()
  const peak = profile.dropGain * (0.65 + Math.random() * 0.7) * profile.intensity
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(peak, time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045 + Math.random() * 0.035)
  drop.connect(filter)
  filter.connect(gain)
  gain.connect(output)
  drop.start(time)
  drop.stop(time + 0.12)
}

function playRainGust(ctx, rainMaster, profile) {
  const time = ctx.currentTime
  const boost = 1.12 + profile.intensity * 0.18 + Math.random() * 0.12
  const duration = (1.8 + Math.random() * 2.4) / profile.speed
  rainMaster.gain.cancelScheduledValues(time)
  rainMaster.gain.setValueAtTime(rainMaster.gain.value, time)
  rainMaster.gain.linearRampToValueAtTime(boost, time + duration * 0.25)
  rainMaster.gain.linearRampToValueAtTime(0.92, time + duration * 0.7)
  rainMaster.gain.linearRampToValueAtTime(1, time + duration)
}

function scheduleRainDrops(ctx, output, profile) {
  scheduleLoop(() => {
    const t = ctx.currentTime
    const burstSize = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 3) : 1
    for (let i = 0; i < burstSize; i += 1) {
      playRainDrop(ctx, output, t + i * (0.018 + Math.random() * 0.025) / profile.speed, profile)
    }
  }, profile.drops[0] / profile.speed, profile.drops[1] / profile.speed)
}

function scheduleRainGusts(ctx, rainMaster, profile) {
  scheduleLoop(() => playRainGust(ctx, rainMaster, profile), profile.gust[0], profile.gust[1])
}

function createRain(options = {}) {
  const ctx = getContext()
  const profileIndex =
    typeof options.trackIndex === 'number'
      ? options.trackIndex % rainProfiles.length
      : Math.floor(Math.random() * rainProfiles.length)
  const profile = rainProfiles[profileIndex]
  const speed = profile.speed
  const intensity = profile.intensity

  const rainMaster = ctx.createGain()
  rainMaster.gain.value = 1
  rainMaster.connect(natureGain)
  trackNode(rainMaster)

  createRainLayer(ctx, rainMaster, {
    filterType: 'lowpass',
    frequency: 1350 * profile.brightness,
    q: 0.5,
    gain: 0.15 * intensity,
    lfoRate: 0.04 * speed,
    lfoDepth: 0.045 * intensity,
    filterLfo: { rate: 0.07 * speed, depth: 280 * profile.brightness },
    playbackRate: 0.94 + speed * 0.1,
  })

  createRainLayer(ctx, rainMaster, {
    filterType: 'lowpass',
    frequency: 380 + profile.brightness * 40,
    q: 0.4,
    gain: 0.09 * intensity,
    lfoRate: 0.025 * speed,
    lfoDepth: 0.025 * intensity,
    playbackRate: 0.9 + speed * 0.08,
  })

  createRainLayer(ctx, rainMaster, {
    filterType: 'bandpass',
    frequency: 950 + profile.brightness * 180,
    q: 0.32 + intensity * 0.08,
    gain: 0.055 * intensity,
    lfoRate: 0.055 * speed,
    lfoDepth: 0.02 * intensity,
    playbackRate: 0.96 + speed * 0.12,
  })

  createRainLayer(ctx, rainMaster, {
    filterType: 'lowpass',
    frequency: 200 + profile.brightness * 30,
    q: 0.3,
    gain: 0.06 * intensity,
    lfoRate: 0.03 * speed,
    lfoDepth: 0.018 * intensity,
    playbackRate: 0.88 + speed * 0.06,
  })

  createRainLayer(ctx, rainMaster, {
    filterType: 'highshelf',
    frequency: 2200 + profile.brightness * 350,
    q: 0.5,
    gain: 0.028 * intensity * profile.brightness,
    playbackRate: 1 + speed * 0.05,
  })

  scheduleRainDrops(ctx, rainMaster, profile)
  scheduleRainGusts(ctx, rainMaster, profile)
}

function scheduleLoop(callback, intervalMin, intervalMax) {
  let cancelled = false
  let timeoutId = null

  const schedule = () => {
    if (cancelled) return
    const delay = intervalMin + Math.random() * (intervalMax - intervalMin)
    timeoutId = setTimeout(() => {
      if (!masterGain || cancelled) return
      callback()
      schedule()
    }, delay * 1000)
  }

  schedule()
  trackNode({
    stop: () => {
      cancelled = true
      clearTimeout(timeoutId)
    },
  })
}

function trackNode(node) {
  activeNodes.push(node)
  return node
}

function connectToMaster(source, gainValue) {
  const ctx = getContext()
  const gain = ctx.createGain()
  gain.gain.value = gainValue
  source.connect(gain)
  gain.connect(natureGain)
  return gain
}

function playWaveCrash(ctx, time, intensity) {
  const thump = ctx.createOscillator()
  const thumpGain = ctx.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(90, time)
  thump.frequency.exponentialRampToValueAtTime(45, time + 0.6)
  thumpGain.gain.setValueAtTime(0, time)
  thumpGain.gain.linearRampToValueAtTime(0.18 * intensity, time + 0.08)
  thumpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.9)
  thump.connect(thumpGain)
  thumpGain.connect(natureGain)
  thump.start(time)
  thump.stop(time + 1)

  const crash = ctx.createBufferSource()
  crash.buffer = createNoiseBuffer(1.5)
  const crashFilter = ctx.createBiquadFilter()
  crashFilter.type = 'bandpass'
  crashFilter.frequency.setValueAtTime(600, time)
  crashFilter.frequency.exponentialRampToValueAtTime(200, time + 0.8)
  crashFilter.Q.value = 0.7
  const crashGain = ctx.createGain()
  crashGain.gain.setValueAtTime(0, time)
  crashGain.gain.linearRampToValueAtTime(0.2 * intensity, time + 0.15)
  crashGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2)
  crash.connect(crashFilter)
  crashFilter.connect(crashGain)
  crashGain.connect(natureGain)
  crash.start(time)
  crash.stop(time + 1.3)

  const foam = ctx.createBufferSource()
  foam.buffer = createNoiseBuffer(0.8)
  const foamFilter = ctx.createBiquadFilter()
  foamFilter.type = 'highpass'
  foamFilter.frequency.value = 1800
  const foamGain = ctx.createGain()
  foamGain.gain.setValueAtTime(0, time + 0.1)
  foamGain.gain.linearRampToValueAtTime(0.08 * intensity, time + 0.25)
  foamGain.gain.exponentialRampToValueAtTime(0.001, time + 1.0)
  foam.connect(foamFilter)
  foamFilter.connect(foamGain)
  foamGain.connect(natureGain)
  foam.start(time + 0.1)
  foam.stop(time + 1.1)
}

function playSandWash(ctx, time, duration, intensity) {
  const wash = ctx.createBufferSource()
  wash.buffer = createNoiseBuffer(duration)
  const washFilter = ctx.createBiquadFilter()
  washFilter.type = 'bandpass'
  washFilter.frequency.setValueAtTime(3200, time)
  washFilter.frequency.exponentialRampToValueAtTime(600, time + duration)
  washFilter.Q.value = 0.6
  const washGain = ctx.createGain()
  washGain.gain.setValueAtTime(0, time)
  washGain.gain.linearRampToValueAtTime(0.14 * intensity, time + 0.12)
  washGain.gain.exponentialRampToValueAtTime(0.001, time + duration)
  wash.connect(washFilter)
  washFilter.connect(washGain)
  washGain.connect(natureGain)
  wash.start(time)
  wash.stop(time + duration + 0.1)

  const sand = ctx.createBufferSource()
  sand.buffer = createNoiseBuffer(duration * 0.8)
  const sandFilter = ctx.createBiquadFilter()
  sandFilter.type = 'bandpass'
  sandFilter.frequency.setValueAtTime(4500, time + 0.2)
  sandFilter.frequency.exponentialRampToValueAtTime(1200, time + duration)
  sandFilter.Q.value = 1.2
  const sandGain = ctx.createGain()
  sandGain.gain.setValueAtTime(0, time + 0.15)
  sandGain.gain.linearRampToValueAtTime(0.1 * intensity, time + 0.35)
  sandGain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.3)
  sand.connect(sandFilter)
  sandFilter.connect(sandGain)
  sandGain.connect(natureGain)
  sand.start(time + 0.15)
  sand.stop(time + duration + 0.4)

  const retreat = ctx.createBufferSource()
  retreat.buffer = createNoiseBuffer(1.2)
  const retreatFilter = ctx.createBiquadFilter()
  retreatFilter.type = 'bandpass'
  retreatFilter.frequency.setValueAtTime(2200, time + duration * 0.5)
  retreatFilter.frequency.exponentialRampToValueAtTime(500, time + duration + 1.5)
  retreatFilter.Q.value = 0.9
  const retreatGain = ctx.createGain()
  retreatGain.gain.setValueAtTime(0, time + duration * 0.4)
  retreatGain.gain.linearRampToValueAtTime(0.07 * intensity, time + duration * 0.6)
  retreatGain.gain.exponentialRampToValueAtTime(0.001, time + duration + 1.8)
  retreat.connect(retreatFilter)
  retreatFilter.connect(retreatGain)
  retreatGain.connect(natureGain)
  retreat.start(time + duration * 0.4)
  retreat.stop(time + duration + 2)
}

function playWaveCycle(ctx) {
  const time = ctx.currentTime
  const intensity = 0.75 + Math.random() * 0.35
  playWaveCrash(ctx, time, intensity)
  playSandWash(ctx, time + 0.6, 2.2 + Math.random() * 1.2, intensity)
}

function createOcean() {
  const ctx = getContext()

  const deep = ctx.createBufferSource()
  deep.buffer = createNoiseBuffer(2)
  deep.loop = true
  const deepFilter = ctx.createBiquadFilter()
  deepFilter.type = 'lowpass'
  deepFilter.frequency.value = 180
  deep.connect(deepFilter)
  connectToMaster(deepFilter, 0.06)
  deep.start()
  trackNode(deep)

  const shore = ctx.createBufferSource()
  shore.buffer = createNoiseBuffer(2)
  shore.loop = true
  const shoreFilter = ctx.createBiquadFilter()
  shoreFilter.type = 'bandpass'
  shoreFilter.frequency.value = 450
  shoreFilter.Q.value = 0.4
  const shoreGain = ctx.createGain()
  shoreGain.gain.value = 0.05
  const shoreLfo = ctx.createOscillator()
  shoreLfo.type = 'sine'
  shoreLfo.frequency.value = 0.06
  const shoreLfoDepth = ctx.createGain()
  shoreLfoDepth.gain.value = 0.03
  shoreLfo.connect(shoreLfoDepth)
  shoreLfoDepth.connect(shoreGain.gain)
  shore.connect(shoreFilter)
  shoreFilter.connect(shoreGain)
  shoreGain.connect(natureGain)
  shore.start()
  shoreLfo.start()
  trackNode(shore)
  trackNode(shoreLfo)

  playWaveCycle(ctx)
  scheduleLoop(() => playWaveCycle(ctx), 5.5, 9.5)
}

function createForest() {
  const ctx = getContext()

  const wind = ctx.createBufferSource()
  wind.buffer = createNoiseBuffer(2)
  wind.loop = true
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'bandpass'
  windFilter.frequency.value = 900
  windFilter.Q.value = 0.25
  wind.connect(windFilter)
  connectToMaster(windFilter, 0.07)
  wind.start()
  trackNode(wind)

  const birdInterval = setInterval(() => {
    if (!masterGain) return
    const osc = ctx.createOscillator()
    const birdGain = ctx.createGain()
    osc.type = 'sine'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(2200 + Math.random() * 600, t)
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.18)
    birdGain.gain.setValueAtTime(0, t)
    birdGain.gain.linearRampToValueAtTime(0.04, t + 0.02)
    birdGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.connect(birdGain)
    birdGain.connect(natureGain)
    osc.start(t)
    osc.stop(t + 0.3)
  }, 3500 + Math.random() * 5000)

  trackNode({ stop: () => clearInterval(birdInterval) })
}

function playCricketBurst(ctx, time, baseFreq, volume) {
  const chirps = 5 + Math.floor(Math.random() * 4)
  for (let i = 0; i < chirps; i += 1) {
    const t = time + i * 0.042
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = baseFreq + (Math.random() - 0.5) * 80
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038)
    osc.connect(gain)
    gain.connect(natureGain)
    osc.start(t)
    osc.stop(t + 0.045)
  }
}

function scheduleCricket(ctx, baseFreq, intervalMin, intervalMax, volume) {
  let cancelled = false
  let timeoutId = null

  const schedule = () => {
    if (cancelled) return
    const delay = intervalMin + Math.random() * (intervalMax - intervalMin)
    timeoutId = setTimeout(() => {
      if (!masterGain || cancelled) return
      playCricketBurst(ctx, ctx.currentTime, baseFreq, volume)
      schedule()
    }, delay * 1000)
  }

  schedule()
  trackNode({
    stop: () => {
      cancelled = true
      clearTimeout(timeoutId)
    },
  })
}

function createCicada(ctx, frequency, volume) {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = frequency

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = 6

  const tremolo = ctx.createOscillator()
  tremolo.type = 'sine'
  tremolo.frequency.value = 18 + Math.random() * 12

  const tremoloDepth = ctx.createGain()
  tremoloDepth.gain.value = volume * 0.45

  const outputGain = ctx.createGain()
  outputGain.gain.value = volume * 0.55

  tremolo.connect(tremoloDepth)
  tremoloDepth.connect(outputGain.gain)
  osc.connect(filter)
  filter.connect(outputGain)
  outputGain.connect(natureGain)

  osc.start()
  tremolo.start()
  trackNode(osc)
  trackNode(tremolo)
}

function createNight() {
  const ctx = getContext()

  const nightWind = ctx.createBufferSource()
  nightWind.buffer = createNoiseBuffer(2)
  nightWind.loop = true
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 400
  nightWind.connect(windFilter)
  connectToMaster(windFilter, 0.025)
  nightWind.start()
  trackNode(nightWind)

  createCicada(ctx, 4800, 0.055)
  createCicada(ctx, 5200, 0.04)
  createCicada(ctx, 6200, 0.03)

  scheduleCricket(ctx, 4200, 0.8, 2.2, 0.07)
  scheduleCricket(ctx, 4600, 1.2, 3.0, 0.06)
  scheduleCricket(ctx, 3900, 1.5, 3.5, 0.055)
  scheduleCricket(ctx, 5100, 2.0, 4.5, 0.05)

  const katydidInterval = setInterval(() => {
    if (!masterGain) return
    const t = ctx.currentTime
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      const start = t + i * 0.12
      osc.frequency.setValueAtTime(2800, start)
      osc.frequency.exponentialRampToValueAtTime(1800, start + 0.35)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.035, start + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4)
      osc.connect(gain)
      gain.connect(natureGain)
      osc.start(start)
      osc.stop(start + 0.45)
    }
  }, 6000 + Math.random() * 8000)

  trackNode({ stop: () => clearInterval(katydidInterval) })
}

const soundCreators = {
  rain: createRain,
  ocean: createOcean,
  forest: createForest,
  night: createNight,
}

function resolveTrackIndex(track) {
  if (!track?.id) return null
  const part = track.id.split('-')[1]
  const index = Number.parseInt(part, 10)
  return Number.isFinite(index) ? index - 1 : null
}

export async function startAmbient(soundType, volume = 0.7, options = {}) {
  stopAmbient()
  await ensureAudioReady()
  natureGain.gain.value = volume * VOLUME_BOOST
  const creator = soundCreators[soundType]
  if (creator) {
    const trackIndex = resolveTrackIndex(options.track)
    creator(trackIndex != null ? { trackIndex } : {})
  }
}

export function setNatureVolume(volume) {
  if (natureGain) {
    natureGain.gain.value = volume * VOLUME_BOOST
  }
}

export function setVolume(volume) {
  setNatureVolume(volume)
}

export function pauseNature() {
  if (natureGain) natureGain.gain.value = 0
}

export function resumeNature(volume) {
  if (natureGain) natureGain.gain.value = volume * VOLUME_BOOST
}

export function stopAmbient() {
  activeNodes.forEach((node) => {
    try {
      node.stop?.()
    } catch {
      // already stopped
    }
  })
  activeNodes = []
}
