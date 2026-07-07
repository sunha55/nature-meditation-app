let autoCloseTimer = null

export function closeGoalCelebrationModal() {
  if (autoCloseTimer) {
    window.clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
  document.querySelector('.celebration-modal')?.remove()
}

export function showGoalCelebrationModal() {
  closeGoalCelebrationModal()

  const overlay = document.createElement('div')
  overlay.className = 'celebration-modal'
  overlay.innerHTML = `
    <div class="celebration-dialog" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <div class="celebration-icon" aria-hidden="true">🎉</div>
      <h3 id="celebration-title">축하드립니다</h3>
      <p class="celebration-message">
        이번주 명상 목표를 달성 하셨습니다.<br />
        한주간도 평안하시길 바랄게요.
      </p>
      <button class="celebration-close" type="button">확인</button>
    </div>
  `

  document.body.appendChild(overlay)

  const close = () => closeGoalCelebrationModal()

  overlay.querySelector('.celebration-close')?.addEventListener('click', close)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })

  autoCloseTimer = window.setTimeout(close, 2000)
}

export function celebrateWeeklyGoal() {
  showGoalCelebrationModal()
}
