import { ensureAudioReady, getMusicGain } from './audio.js'

const MUSIC_BOOST = 1.4
let musicNodes = []
let musicTimers = []
let droneGains = []
let currentVolume = 0.55
let muted = false

function trackNode(node) {
  musicNodes.push(node)
}

function trackTimer(fn) {
  musicTimers.push(fn)
}

function noteFreq(track, degree) {
  const scale = track.scale
  const index = ((degree % scale.length) + scale.length) % scale.length
  const octave = Math.floor(degree / scale.length)
  const semitone = scale[index] + octave * 12
  return track.root * 2 ** (semitone / 12)
}

function createFilter(ctx, type, frequency, q = 0.7) {
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  return filter
}

function playTone(ctx, output, frequency, time, duration, volume, type = 'sine') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(volume, time + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
  osc.connect(gain)
  gain.connect(output)
  osc.start(time)
  osc.stop(time + duration + 0.05)
}

function startDrones(ctx, track, output) {
  droneGains = []
  const firstChord = track.chords[0]

  firstChord.forEach((degree, index) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = noteFreq(track, degree)
    if (index === 1) osc.detune.value = 4
    if (index === 2) osc.detune.value = -3
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.85)
    osc.connect(gain)
    gain.connect(output)
    osc.start()
    droneGains.push({ osc, gain, degree })
    trackNode(osc)
  })
}

function changeChord(ctx, track, chordIndex) {
  const chord = track.chords[chordIndex % track.chords.length]
  const time = ctx.currentTime
  droneGains.forEach(({ osc, gain, degree }, index) => {
    const targetDegree = chord[index] ?? chord[0]
    osc.frequency.exponentialRampToValueAtTime(noteFreq(track, targetDegree), time + 3)
    gain.gain.setTargetAtTime(0.03 + index * 0.004, time, 2)
  })
}

function scheduleChords(ctx, track) {
  let chordIndex = 0
  let cancelled = false
  let timeoutId = null

  const schedule = () => {
    if (cancelled) return
    timeoutId = setTimeout(() => {
      if (cancelled) return
      chordIndex += 1
      changeChord(ctx, track, chordIndex)
      schedule()
    }, track.chordDuration * 1000)
  }

  schedule()
  trackTimer(() => {
    cancelled = true
    clearTimeout(timeoutId)
  })
}

function scheduleMelody(ctx, track, output, style) {
  let cancelled = false
  let timeoutId = null
  let isFirst = true

  const play = () => {
    if (cancelled) return
    const delay = isFirst
      ? 0.35 + Math.random() * 0.55
      : track.noteInterval[0] + Math.random() * (track.noteInterval[1] - track.noteInterval[0])
    isFirst = false
    timeoutId = setTimeout(() => {
      if (cancelled) return
      const t = ctx.currentTime
      const degree = Math.floor(Math.random() * track.scale.length) + Math.floor(Math.random() * 2) * track.scale.length
      const freq = noteFreq(track, degree)

      if (style === 'bell') {
        playTone(ctx, output, freq, t, 4.5, 0.045, 'sine')
        playTone(ctx, output, freq * 2, t, 3, 0.015, 'sine')
      } else if (style === 'harp') {
        track.chords[0].forEach((d, i) => {
          playTone(ctx, output, noteFreq(track, d), t + i * 0.18, 2.2, 0.03, 'triangle')
        })
      } else if (style === 'flow') {
        const steps = 4 + Math.floor(Math.random() * 3)
        for (let i = 0; i < steps; i += 1) {
          const stepDegree = (degree + i) % (track.scale.length + 3)
          playTone(ctx, output, noteFreq(track, stepDegree), t + i * 0.35, 1.8, 0.028, 'sine')
        }
      } else {
        playTone(ctx, output, freq, t, 3.5, 0.032, 'sine')
      }

      play()
    }, delay * 1000)
  }

  play()
  trackTimer(() => {
    cancelled = true
    clearTimeout(timeoutId)
  })
}

function buildOutputChain(ctx, track) {
  const output = ctx.createGain()
  output.gain.value = 1
  const filter = createFilter(ctx, 'lowpass', track.style === 'drone' ? 520 : 820, 0.5)
  output.connect(filter)
  filter.connect(getMusicGain())
  trackNode(output)
  trackNode(filter)
  return output
}

function startPadTrack(ctx, track, output) {
  startDrones(ctx, track, output)
  scheduleChords(ctx, track)
  if (track.style !== 'drone') {
    scheduleMelody(ctx, track, output, track.style === 'bell' ? 'bell' : 'pad')
  }
}

function startBellTrack(ctx, track, output) {
  startDrones(ctx, track, output)
  scheduleChords(ctx, track)
  scheduleMelody(ctx, track, output, 'bell')
}

function startFlowTrack(ctx, track, output) {
  startDrones(ctx, track, output)
  scheduleChords(ctx, track)
  scheduleMelody(ctx, track, output, 'flow')
}

function startHarpTrack(ctx, track, output) {
  startDrones(ctx, track, output)
  scheduleChords(ctx, track)
  scheduleMelody(ctx, track, output, 'harp')
}

function startDroneTrack(ctx, track, output) {
  startDrones(ctx, track, output)
  scheduleChords(ctx, track)
}

const styleStarters = {
  pad: startPadTrack,
  drone: startDroneTrack,
  bell: startBellTrack,
  flow: startFlowTrack,
  harp: startHarpTrack,
}

export async function startMusic(track, volume = 0.55) {
  stopMusic()
  const ctx = await ensureAudioReady()
  currentVolume = volume
  muted = false
  getMusicGain().gain.value = volume * MUSIC_BOOST

  const output = buildOutputChain(ctx, track)
  const starter = styleStarters[track.style] ?? startPadTrack
  starter(ctx, track, output)
}

export function setMusicVolume(volume) {
  currentVolume = volume
  if (!muted && getMusicGain()) {
    getMusicGain().gain.value = volume * MUSIC_BOOST
  }
}

export function pauseMusic() {
  muted = true
  if (getMusicGain()) getMusicGain().gain.value = 0
}

export function resumeMusic() {
  muted = false
  if (getMusicGain()) getMusicGain().gain.value = currentVolume * MUSIC_BOOST
}

export function stopMusic() {
  musicTimers.forEach((cancel) => cancel())
  musicTimers = []
  droneGains = []

  musicNodes.forEach((node) => {
    try {
      node.stop?.()
    } catch {
      // already stopped
    }
  })
  musicNodes = []
}
