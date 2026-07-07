const COLORS = ['#a3e635', '#86efac', '#fde047', '#fbbf24', '#f472b6', '#67e8f9', '#c4b5fd', '#ffffff']

function resizeCanvas(canvas) {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

export function launchFireworks(duration = 3200) {
  const canvas = document.createElement('canvas')
  canvas.className = 'fireworks-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  resizeCanvas(canvas)

  const ctx = canvas.getContext('2d')
  const particles = []
  let rafId = null
  let burstTimer = null
  const startedAt = performance.now()

  const onResize = () => resizeCanvas(canvas)
  window.addEventListener('resize', onResize)

  function burst(x, y) {
    const count = 28 + Math.floor(Math.random() * 18)
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.8 + Math.random() * 4.2
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.01 + Math.random() * 0.018,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 1.5 + Math.random() * 2.5,
      })
    }
  }

  function spawnBurst() {
    burst(
      canvas.width * (0.15 + Math.random() * 0.7),
      canvas.height * (0.12 + Math.random() * 0.45),
    )
  }

  spawnBurst()
  burstTimer = window.setInterval(spawnBurst, 420)

  function cleanup() {
    window.clearInterval(burstTimer)
    window.cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    canvas.remove()
  }

  function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i]
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += 0.035
      particle.vx *= 0.985
      particle.life -= particle.decay

      if (particle.life <= 0) {
        particles.splice(i, 1)
        continue
      }

      ctx.globalAlpha = Math.max(0, particle.life)
      ctx.fillStyle = particle.color
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1

    if (now - startedAt < duration) {
      rafId = window.requestAnimationFrame(frame)
    } else {
      cleanup()
    }
  }

  rafId = window.requestAnimationFrame(frame)
}
