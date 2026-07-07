const EDGE_PX = 40
const EDGE_RATIO = 0.22
const MIN_SWIPE_PX = 72
const MAX_VERTICAL_RATIO = 0.55

export function bindSwipeBackHome(element, onSwipeHome) {
  if (!element || typeof onSwipeHome !== 'function') {
    return () => {}
  }

  let startX = 0
  let startY = 0
  let tracking = false

  function canStartFrom(x) {
    return x <= EDGE_PX || x <= window.innerWidth * EDGE_RATIO
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

    onSwipeHome()
  }

  function onTouchCancel() {
    tracking = false
  }

  element.addEventListener('touchstart', onTouchStart, { passive: true })
  element.addEventListener('touchend', onTouchEnd, { passive: true })
  element.addEventListener('touchcancel', onTouchCancel, { passive: true })

  return () => {
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchend', onTouchEnd)
    element.removeEventListener('touchcancel', onTouchCancel)
  }
}
