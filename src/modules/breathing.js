import { breathingPattern } from '../data/themes.js'

const phases = [
  { key: 'inhale', label: '들이쉬기', duration: breathingPattern.inhale },
  { key: 'hold', label: '멈춤', duration: breathingPattern.hold },
  { key: 'exhale', label: '내쉬기', duration: breathingPattern.exhale },
  { key: 'pause', label: '휴식', duration: breathingPattern.pause },
]

export function createBreathingGuide(onPhaseChange) {
  let phaseIndex = 0
  let countdown = phases[0].duration
  let intervalId = null
  let running = false

  function advancePhase() {
    phaseIndex = (phaseIndex + 1) % phases.length
    countdown = phases[phaseIndex].duration
    onPhaseChange(phases[phaseIndex], countdown)
  }

  function tick() {
    countdown -= 1
    if (countdown <= 0) {
      advancePhase()
    } else {
      onPhaseChange(phases[phaseIndex], countdown)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      phaseIndex = 0
      countdown = phases[0].duration
      onPhaseChange(phases[0], countdown)
      intervalId = setInterval(tick, 1000)
    },
    stop() {
      running = false
      clearInterval(intervalId)
      intervalId = null
    },
    getPhase() {
      return phases[phaseIndex]
    },
  }
}
