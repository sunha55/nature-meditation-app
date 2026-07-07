export function createTimer(onTick, onComplete) {
  let remaining = 0
  let intervalId = null
  let isPaused = false

  function tick() {
    if (isPaused) return
    remaining -= 1
    onTick(remaining)
    if (remaining <= 0) {
      clearInterval(intervalId)
      intervalId = null
      onComplete()
    }
  }

  return {
    start(seconds) {
      remaining = seconds
      isPaused = false
      clearInterval(intervalId)
      onTick(remaining)
      intervalId = setInterval(tick, 1000)
    },
    pause() {
      isPaused = true
    },
    resume() {
      isPaused = false
    },
    stop() {
      clearInterval(intervalId)
      intervalId = null
      remaining = 0
    },
    getRemaining() {
      return remaining
    },
    isRunning() {
      return intervalId !== null && !isPaused
    },
    isPaused() {
      return isPaused
    },
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
