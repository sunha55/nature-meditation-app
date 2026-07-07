const EDGE_RATIO = 0.55
const MIN_SWIPE_PX = 48
const MAX_VERTICAL_RATIO = 0.8

export function bindSwipeBackHome(element, onSwipeBack) {
  if (typeof onSwipeBack !== 'function') {
    return () => {}
  }

  const target = element ?? document
  let startX = 0
  let startY = 0
  let tracking = false

  function canStartFrom(x) {
    return x <= window.innerWidth * EDGE_RATIO
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    tracking = canStartFrom(startX)
  }

  function onTouchEnd(event) {
    if (!tracking) return
    tracking = false

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    if (deltaX < MIN_SWIPE_PX) return
    if (Math.abs(deltaY) > Math.abs(deltaX) * MAX_VERTICAL_RATIO) return

    onSwipeBack()
  }

  function onTouchCancel() {
    tracking = false
  }

  target.addEventListener('touchstart', onTouchStart, { passive: true })
  target.addEventListener('touchend', onTouchEnd, { passive: true })
  target.addEventListener('touchcancel', onTouchCancel, { passive: true })

  return () => {
    target.removeEventListener('touchstart', onTouchStart)
    target.removeEventListener('touchend', onTouchEnd)
    target.removeEventListener('touchcancel', onTouchCancel)
  }
}
