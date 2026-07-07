export const bowlSizes = {
  xlarge: {
    partials: [
      { mult: 1, amp: 1, decay: 17 },
      { mult: 2.02, amp: 0.44, decay: 13 },
      { mult: 3.08, amp: 0.2, decay: 9 },
      { mult: 4.15, amp: 0.09, decay: 6 },
      { mult: 5.4, amp: 0.04, decay: 4 },
    ],
    clickMix: 0.05,
    clickFreq: 900,
    volumeScale: 1.05,
    detune: [-4, 3],
  },
  large: {
    partials: [
      { mult: 1, amp: 1, decay: 14 },
      { mult: 2.05, amp: 0.4, decay: 10.5 },
      { mult: 3.1, amp: 0.19, decay: 7.2 },
      { mult: 4.22, amp: 0.1, decay: 4.8 },
    ],
    clickMix: 0.065,
    clickFreq: 1200,
    volumeScale: 0.95,
    detune: [-3, 4],
  },
  medium: {
    partials: [
      { mult: 1, amp: 1, decay: 11 },
      { mult: 2.07, amp: 0.36, decay: 8 },
      { mult: 3.14, amp: 0.17, decay: 5.5 },
      { mult: 4.28, amp: 0.08, decay: 3.8 },
    ],
    clickMix: 0.075,
    clickFreq: 1600,
    volumeScale: 0.82,
    detune: [-2, 3],
  },
  small: {
    partials: [
      { mult: 1, amp: 1, decay: 8.5 },
      { mult: 2.11, amp: 0.32, decay: 6 },
      { mult: 3.18, amp: 0.14, decay: 4.2 },
      { mult: 4.35, amp: 0.06, decay: 2.8 },
    ],
    clickMix: 0.085,
    clickFreq: 2100,
    volumeScale: 0.68,
    detune: [-2, 2],
  },
  xsmall: {
    partials: [
      { mult: 1, amp: 1, decay: 6.5 },
      { mult: 2.14, amp: 0.28, decay: 4.5 },
      { mult: 3.22, amp: 0.11, decay: 3 },
    ],
    clickMix: 0.09,
    clickFreq: 2600,
    volumeScale: 0.55,
    detune: [-1, 2],
  },
}

const themeFallbackRoots = {
  forest: 82.41,
  rain: 73.42,
  ocean: 65.41,
  night: 73.42,
}

function semitoneFreq(root, semitones) {
  return root * 2 ** (semitones / 12)
}

function pickSizeForDegree(semitones, octaveShift) {
  const pitch = semitones + octaveShift * 12
  if (pitch <= -5) return 'xlarge'
  if (pitch <= 0) return 'large'
  if (pitch <= 5) return 'medium'
  if (pitch <= 10) return 'small'
  return 'xsmall'
}

export function buildBowlEnsemble(track, themeId = null) {
  const root = track?.root ?? themeFallbackRoots[themeId] ?? 174.61
  const scale = track?.scale ?? [0, 2, 4, 7, 9]
  const style = track?.style ?? 'pad'

  const degreePlans = [
    { degree: 0, octave: -1, gain: 0.88 },
    { degree: 2, octave: -1, gain: 0.72 },
    { degree: 0, octave: 0, gain: 0.95 },
    { degree: 2, octave: 0, gain: 0.8 },
    { degree: 4, octave: 0, gain: 0.74 },
    { degree: 1, octave: 1, gain: 0.62 },
    { degree: 3, octave: 1, gain: 0.56 },
    { degree: 4, octave: 1, gain: 0.5 },
  ]

  if (style === 'drone') {
    degreePlans[0].gain = 1
    degreePlans[2].gain = 0.85
    degreePlans[5].gain = 0.42
  } else if (style === 'bell') {
    degreePlans[4].gain = 0.9
    degreePlans[5].gain = 0.78
    degreePlans[6].gain = 0.72
  } else if (style === 'harp' || style === 'flow') {
    degreePlans[3].gain = 0.88
    degreePlans[4].gain = 0.82
    degreePlans[6].gain = 0.68
  }

  return degreePlans.map(({ degree, octave, gain }) => {
    const scaleDegree = scale[degree % scale.length] ?? 0
    const semitones = scaleDegree + octave * 12
    return {
      freq: semitoneFreq(root, semitones),
      size: pickSizeForDegree(scaleDegree, octave),
      gain,
    }
  })
}

export function getPatternWeights(track) {
  const style = track?.style ?? 'pad'
  if (style === 'drone') {
    return { single: 0.28, overlap: 0.24, cascade: 0.12, cluster: 0.22, echo: 0.14 }
  }
  if (style === 'bell') {
    return { single: 0.18, overlap: 0.22, cascade: 0.28, cluster: 0.18, echo: 0.14 }
  }
  if (style === 'harp' || style === 'flow') {
    return { single: 0.16, overlap: 0.18, cascade: 0.32, cluster: 0.16, echo: 0.18 }
  }
  return { single: 0.22, overlap: 0.24, cascade: 0.2, cluster: 0.2, echo: 0.14 }
}

export function getIntervalRange(track) {
  const style = track?.style ?? 'pad'
  if (style === 'drone') return { min: 38, max: 62 }
  if (style === 'bell') return { min: 24, max: 42 }
  if (style === 'harp' || style === 'flow') return { min: 20, max: 36 }
  return { min: 28, max: 48 }
}

export function getThemeFallbackRoot(themeId) {
  return themeFallbackRoots[themeId] ?? 174.61
}
