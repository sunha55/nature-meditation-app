import { themes, durations } from './data/themes.js'
import { getTracksForTheme, getTrackById } from './data/tracks.js'
import { loadStats, saveSession, loadFavorites, toggleFavorite, isFavorite, loadPreferences, savePreferences, getWeeklyChartData, isWeeklyGoalAchieved } from './modules/storage.js'
import { launchFireworks } from './modules/fireworks.js'
import { celebrateWeeklyGoal, closeGoalCelebrationModal } from './modules/celebration.js'
import { startAmbient, stopAmbient, pauseNature, resumeNature, setNatureVolume } from './modules/audio.js'
import { startMusic, stopMusic, pauseMusic, resumeMusic, setMusicVolume } from './modules/music.js'
import {
  startSingingBowl,
  stopSingingBowl,
  pauseSingingBowl,
  resumeSingingBowl,
  setSingingBowlVolume,
} from './modules/singingbowl.js'
import { createTimer, formatTime } from './modules/timer.js'
import { createBreathingGuide } from './modules/breathing.js'
import { bindSwipeBackHome } from './modules/swipe-back.js'

const NO_TRACK = 'none'
const prefs = loadPreferences()

const state = {
  screen: 'home',
  theme: null,
  track: null,
  duration: 10,
  breathingEnabled: prefs.breathingEnabled,
  natureVolume: prefs.natureVolume,
  musicVolume: prefs.musicVolume,
  singingBowlVolume: prefs.singingBowlVolume,
  weeklyGoal: prefs.weeklyGoal ?? 3,
  stats: loadStats(),
  favorites: loadFavorites(),
  returnScreen: 'setup',
}

let timer = null
let breathing = null
let selectedDuration = 10
let selectedTrackId = NO_TRACK
let lastScreen = null
let swipeCleanup = null
let historyReady = false
let handlingPopState = false

const app = document.querySelector('#app')

function getHistorySnapshot() {
  return {
    app: 'nature-meditation',
    screen: state.screen,
    themeId: state.theme?.id ?? null,
  }
}

function initAppHistory() {
  if (historyReady) return
  history.replaceState(getHistorySnapshot(), '')
  window.addEventListener('popstate', onPopState)
  historyReady = true
}

function pushAppHistory() {
  if (!historyReady || handlingPopState) return
  history.pushState(getHistorySnapshot(), '')
}

function onPopState(event) {
  const snap = event.state

  handlingPopState = true
  try {
    if (!snap || snap.app !== 'nature-meditation') {
      if (state.screen === 'session') {
        applyNavigateToSetup()
      } else if (state.screen === 'setup') {
        applyNavigateToHome()
      }
      return
    }

    if (snap.screen === 'home') {
      applyNavigateToHome()
      return
    }

    if (snap.screen === 'setup') {
      applyNavigateToSetup(snap.themeId)
      return
    }

    if (snap.screen === 'mypage') {
      closeGoalCelebrationModal()
      if (state.screen === 'session') stopSession()
      state.theme = null
      state.track = null
      state.screen = 'mypage'
      applyAppSurface()
      render()
    }
  } finally {
    handlingPopState = false
  }
}

function applyNavigateToSetup(themeId = state.theme?.id ?? null) {
  closeGoalCelebrationModal()
  if (state.screen === 'session') {
    stopSession()
  }
  if (themeId) {
    state.theme = themes.find((theme) => theme.id === themeId) ?? state.theme
  }
  state.screen = 'setup'
  if (state.theme) {
    applyAppSurface(state.theme)
  }
  render()
}

function applyNavigateToHome() {
  closeGoalCelebrationModal()
  if (state.screen === 'session') {
    stopSession()
  }
  state.theme = null
  state.track = null
  state.screen = 'home'
  applyAppSurface()
  render()
}

function goBackOneScreen() {
  if (state.screen === 'session' || state.screen === 'setup') {
    history.back()
  }
}

function persistPrefs() {
  savePreferences({
    natureVolume: state.natureVolume,
    musicVolume: state.musicVolume,
    breathingEnabled: state.breathingEnabled,
    singingBowlVolume: state.singingBowlVolume,
    weeklyGoal: state.weeklyGoal,
  })
}

function applyAppSurface(theme = null) {
  if (theme) {
    app.style.background = theme.color
    app.dataset.theme = theme.id
    app.style.setProperty('--session-accent', theme.accent)
  } else {
    app.style.background = ''
    app.dataset.theme = ''
    app.style.removeProperty('--session-accent')
  }
}

function getFavoriteEntries() {
  return state.favorites
    .map((trackId) => {
      const track = getTrackById(trackId)
      if (!track) return null
      const theme = themes.find((t) => t.id === track.themeId)
      if (!theme) return null
      return { track, theme }
    })
    .filter(Boolean)
}

function renderWeeklyChart(days, weeklyGoal) {
  const weekTotal = days.reduce((sum, day) => sum + day.sessions, 0)
  const maxSessions = Math.max(1, ...days.map((day) => day.sessions))
  const goalAchieved = weekTotal >= weeklyGoal
  const progress = Math.min(100, Math.round((weekTotal / weeklyGoal) * 100))

  return `
    <section class="weekly-chart ${goalAchieved ? 'weekly-chart--achieved' : ''}" aria-label="이번 주 명상 기록">
      <div class="weekly-chart-header">
        <div>
          <h3>이번 주 명상</h3>
          <p class="weekly-chart-caption">월요일부터 일요일까지의 명상 횟수</p>
        </div>
        <div class="weekly-chart-summary">
          <span class="weekly-chart-total">${weekTotal}</span>
          <span class="weekly-chart-total-label">회</span>
        </div>
      </div>

      <div class="weekly-goal">
        <div class="weekly-goal-top">
          <span class="weekly-goal-label">이번 주 목표</span>
          <div class="weekly-goal-controls">
            <button class="weekly-goal-btn" id="goal-dec" type="button" aria-label="목표 줄이기">−</button>
            <span class="weekly-goal-value">주 <strong id="goal-count">${weeklyGoal}</strong>회</span>
            <button class="weekly-goal-btn" id="goal-inc" type="button" aria-label="목표 늘리기">+</button>
          </div>
        </div>
        <div class="weekly-goal-progress" aria-label="목표 진행 ${weekTotal}회 중 ${weeklyGoal}회">
          <div class="weekly-goal-track">
            <div class="weekly-goal-fill" style="width: ${progress}%"></div>
          </div>
          <p class="weekly-goal-status">
            ${goalAchieved ? '<span class="weekly-goal-badge">🎉 목표 달성!</span>' : `<span>${weekTotal} / ${weeklyGoal}회</span>`}
          </p>
        </div>
      </div>

      <div class="weekly-chart-bars" role="list">
        ${days
          .map(
            (day) => `
          <div
            class="weekly-bar-col ${day.isToday ? 'is-today' : ''} ${day.sessions > 0 ? 'has-data' : ''}"
            role="listitem"
            aria-label="${day.label}요일 ${day.sessions}회, ${day.minutes}분"
          >
            <span class="weekly-bar-value">${day.sessions > 0 ? day.sessions : ''}</span>
            <div class="weekly-bar-track" aria-hidden="true">
              <div class="weekly-bar-fill" style="height: ${day.sessions > 0 ? Math.round((day.sessions / maxSessions) * 100) : 0}%"></div>
            </div>
            <span class="weekly-bar-label">${day.label}</span>
            ${day.minutes > 0 ? `<span class="weekly-bar-minutes">${day.minutes}분</span>` : ''}
          </div>
        `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderTrackRows(tracks) {
  return tracks
    .map(
      (track) => `
    <div class="track-row">
      <button class="track-item" data-track-id="${track.id}" type="button">
        <span class="track-number">${track.id.split('-')[1]}</span>
        <span class="track-info">
          <span class="track-name">${track.name}</span>
          <span class="track-sub">${track.subtitle}</span>
        </span>
      </button>
      <button class="favorite-btn ${isFavorite(track.id) ? 'active' : ''}" data-track-id="${track.id}" type="button" aria-label="${isFavorite(track.id) ? '좋아요 취소' : '좋아요'}">♥</button>
    </div>
  `,
    )
    .join('')
}

function bindFavoriteButtons(container) {
  container.querySelectorAll('.favorite-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      state.favorites = toggleFavorite(btn.dataset.trackId)
      render()
    })
  })
}

function goSetupFromSession() {
  goBackOneScreen()
}

function goHome() {
  closeGoalCelebrationModal()
  if (state.screen === 'session') {
    stopSession()
  }
  state.theme = null
  state.track = null
  state.screen = 'home'
  applyAppSurface()
  if (historyReady) {
    history.replaceState(getHistorySnapshot(), '')
  }
  render()
}

function handleSwipeBack() {
  goBackOneScreen()
}

function bindSwipeNavigation() {
  swipeCleanup?.()
  swipeCleanup = null

  if (state.screen !== 'setup' && state.screen !== 'session') return

  swipeCleanup = bindSwipeBackHome(document, handleSwipeBack)
}

function goMyPage() {
  state.theme = null
  state.track = null
  state.screen = 'mypage'
  applyAppSurface()
  pushAppHistory()
  render()
}

function renderBottomNav(active) {
  return `
    <nav class="bottom-nav" aria-label="하단 메뉴">
      <button class="bottom-nav-item ${active === 'home' ? 'active' : ''}" data-nav="home" type="button">
        <span class="bottom-nav-icon">🏠</span>
        <span class="bottom-nav-label">홈</span>
      </button>
      <button class="bottom-nav-item ${active === 'mypage' ? 'active' : ''}" data-nav="mypage" type="button">
        <span class="bottom-nav-icon">♥</span>
        <span class="bottom-nav-label">내 페이지</span>
      </button>
    </nav>
  `
}

function renderWithBottomNav(screenHtml, activeTab) {
  app.innerHTML = `
    <div class="app-shell has-bottom-nav">
      ${screenHtml}
      ${renderBottomNav(activeTab)}
    </div>
  `
  bindBottomNav()
}

function bindBottomNav() {
  app.querySelector('[data-nav="home"]')?.addEventListener('click', goHome)
  app.querySelector('[data-nav="mypage"]')?.addEventListener('click', goMyPage)
}

function render() {
  const enteringMyPage = state.screen === 'mypage' && lastScreen !== 'mypage'
  const leavingMyPage = lastScreen === 'mypage' && state.screen !== 'mypage'

  if (leavingMyPage) {
    closeGoalCelebrationModal()
  }

  app.dataset.screen = state.screen
  app.dataset.theme = state.theme?.id ?? ''

  if (state.screen === 'home') renderHome()
  else if (state.screen === 'mypage') renderMyPage()
  else if (state.screen === 'setup') renderSetup()
  else if (state.screen === 'session') renderSession()

  if (enteringMyPage && isWeeklyGoalAchieved(state.weeklyGoal)) {
    requestAnimationFrame(() => {
      launchFireworks()
      celebrateWeeklyGoal()
    })
  }

  lastScreen = state.screen
  bindSwipeNavigation()
}

function renderHome() {
  applyAppSurface()

  renderWithBottomNav(
    `
    <div class="screen home-screen">
      <header class="hero-header">
        <p class="eyebrow">Nature Meditation</p>
        <h1>자연과 함께<br>마음을 가다듬으세요</h1>
        <p class="subtitle">자연 소리, 명상 음악, 싱잉볼을 자유롭게 조합하세요</p>
      </header>

      <section class="theme-grid" aria-label="자연 테마 선택">
        ${themes
          .map(
            (theme) => `
          <button class="theme-card" data-theme-id="${theme.id}" style="--card-accent: ${theme.accent}" type="button">
            <span class="theme-icon-wrap">${theme.emoji}</span>
            <span class="theme-name">${theme.name}</span>
            <span class="theme-desc">${theme.description}</span>
          </button>
        `,
          )
          .join('')}
      </section>
    </div>
  `,
    'home',
  )

  app.querySelectorAll('.theme-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.theme = themes.find((t) => t.id === btn.dataset.themeId)
      selectedTrackId = NO_TRACK
      state.screen = 'setup'
      pushAppHistory()
      render()
    })
  })
}

function renderMyPage() {
  applyAppSurface()
  state.stats = loadStats()
  const entries = getFavoriteEntries()
  const weeklyDays = getWeeklyChartData()

  renderWithBottomNav(
    `
    <div class="screen mypage-screen">
      <header class="mypage-header">
        <h2>내 페이지</h2>
        <p>나의 명상 기록과 좋아하는 곡</p>
      </header>

      <section class="stats-bar stats-bar--mypage" aria-label="명상 통계">
        <div class="stat">
          <span class="stat-value">${state.stats.totalMinutes}</span>
          <span class="stat-label">총 분</span>
        </div>
        <div class="stat">
          <span class="stat-value">${state.stats.streak}</span>
          <span class="stat-label">연속 일</span>
        </div>
      </section>

      ${renderWeeklyChart(weeklyDays, state.weeklyGoal)}

      <section class="mylist-section">
        <h3>나만의 명상 리스트 · ${entries.length}곡</h3>
        ${
          entries.length === 0
            ? `
          <div class="mylist-empty mylist-empty--compact">
            <p>아직 저장한 곡이 없어요</p>
            <span>테마에서 ♥ 버튼을 눌러<br>좋아하는 명상 음악을 추가해보세요</span>
          </div>
        `
            : `
          <div class="mylist-items">
            ${entries
              .map(
                ({ track, theme }) => `
              <div class="mylist-item">
                <div class="mylist-item-main">
                  <div class="mylist-art">${theme.emoji}</div>
                  <div class="mylist-meta">
                    <span class="mylist-track">${track.name}</span>
                    <span class="mylist-sub">${theme.name} · ${track.subtitle}</span>
                  </div>
                </div>
                <div class="mylist-actions">
                  <button class="favorite-btn active" data-track-id="${track.id}" type="button" aria-label="좋아요 취소">♥</button>
                  <button class="mylist-play-btn" data-track-id="${track.id}" data-theme-id="${theme.id}" type="button">명상하기</button>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
        }
      </section>
    </div>
  `,
    'mypage',
  )

  bindFavoriteButtons(app)

  app.querySelector('#goal-dec')?.addEventListener('click', () => {
    state.weeklyGoal = Math.max(1, state.weeklyGoal - 1)
    persistPrefs()
    render()
  })

  app.querySelector('#goal-inc')?.addEventListener('click', () => {
    state.weeklyGoal = Math.min(14, state.weeklyGoal + 1)
    persistPrefs()
    render()
  })

  app.querySelectorAll('.mylist-play-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.theme = themes.find((t) => t.id === btn.dataset.themeId)
      startSession(btn.dataset.trackId)
    })
  })
}

function renderSetup() {
  const theme = state.theme
  applyAppSurface(theme)
  const tracks = getTracksForTheme(theme.id)

  renderWithBottomNav(
    `
    <div class="screen setup-screen">
      <header class="setup-header">
        <span class="setup-emoji">${theme.emoji}</span>
        <h2>${theme.name}</h2>
        <p>${theme.description}</p>
      </header>

      <section class="setup-section">
        <h3>명상 시간</h3>
        <div class="duration-grid">
          ${durations
            .map(
              (d) => `
            <button class="duration-btn ${d === selectedDuration ? 'active' : ''}" data-duration="${d}" type="button">
              ${d}분
            </button>
          `,
            )
            .join('')}
        </div>
      </section>

      <section class="setup-section">
        <h3>설정</h3>
        <label class="toggle-row">
          <span>호흡 가이드</span>
          <input type="checkbox" id="breathing-toggle" ${state.breathingEnabled ? 'checked' : ''} />
          <span class="toggle-switch"></span>
        </label>
        <label class="volume-row">
          <span>자연 소리</span>
          <input type="range" id="nature-volume" min="0" max="100" value="${Math.round(state.natureVolume * 100)}" />
        </label>
        <label class="volume-row">
          <span>명상 음악</span>
          <input type="range" id="music-volume" min="0" max="100" value="${Math.round(state.musicVolume * 100)}" />
        </label>
        <label class="volume-row volume-row--bowl">
          <span class="volume-row-label">
            <span>싱잉볼</span>
            <span class="volume-row-hint">넣을 양</span>
          </span>
          <div class="volume-slider-wrap">
            <div class="volume-slider-labels" aria-hidden="true">
              <span>없음</span>
              <span>풍부하게</span>
            </div>
            <input
              type="range"
              id="bowl-volume"
              min="0"
              max="100"
              value="${Math.round(state.singingBowlVolume * 100)}"
              aria-valuetext="${state.singingBowlVolume <= 0 ? '싱잉볼 없음' : state.singingBowlVolume >= 0.95 ? '싱잉볼 풍부하게' : `싱잉볼 ${Math.round(state.singingBowlVolume * 100)}%`}"
            />
          </div>
        </label>
      </section>

      <section class="setup-section">
        <h3>명상 음악 · ${tracks.length}곡</h3>
        <p class="setup-hint">곡을 누르면 바로 명상이 시작됩니다</p>
        <div class="track-list">
          <button class="track-item" data-track-id="${NO_TRACK}" type="button">
            <span class="track-number">—</span>
            <span class="track-info">
              <span class="track-name">음악 없음</span>
              <span class="track-sub">자연 소리만 듣기</span>
            </span>
          </button>
          ${renderTrackRows(tracks)}
        </div>
      </section>
    </div>
  `,
    null,
  )

  app.querySelectorAll('.duration-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedDuration = Number(btn.dataset.duration)
      app.querySelectorAll('.duration-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  app.querySelector('#breathing-toggle').addEventListener('change', (e) => {
    state.breathingEnabled = e.target.checked
    persistPrefs()
  })

  app.querySelectorAll('.track-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      startSession(btn.dataset.trackId)
    })
  })

  bindFavoriteButtons(app)

  app.querySelector('#nature-volume').addEventListener('input', (e) => {
    state.natureVolume = Number(e.target.value) / 100
    persistPrefs()
  })

  app.querySelector('#music-volume').addEventListener('input', (e) => {
    state.musicVolume = Number(e.target.value) / 100
    persistPrefs()
  })

  app.querySelector('#bowl-volume').addEventListener('input', (e) => {
    state.singingBowlVolume = Number(e.target.value) / 100
    e.target.setAttribute(
      'aria-valuetext',
      state.singingBowlVolume <= 0
        ? '싱잉볼 없음'
        : state.singingBowlVolume >= 0.95
          ? '싱잉볼 풍부하게'
          : `싱잉볼 ${Math.round(state.singingBowlVolume * 100)}%`,
    )
    persistPrefs()
  })
}

function renderSession() {
  const theme = state.theme
  const hasMusic = Boolean(state.track)
  applyAppSurface(theme)

  app.innerHTML = `
    <div class="app-shell">
    <div class="screen session-screen">
      <header class="session-header">
        <button class="session-back-btn" id="session-back-btn" type="button" aria-label="노래 선택으로 돌아가기">← 뒤로</button>
        <span class="session-theme">${theme.emoji} ${theme.name}</span>
      </header>

      <div class="timer-shell">
        <div class="timer-display" id="timer-display">${formatTime(state.duration * 60)}</div>
        <div class="timer-label">남은 시간</div>
      </div>

      <div class="breathing-area ${state.breathingEnabled ? '' : 'hidden'}" id="breathing-area">
        <div class="breathing-stack">
          <div class="breathing-ring breathing-ring--outer"></div>
          <div class="breathing-ring breathing-ring--inner"></div>
          <div class="breathing-circle" id="breathing-circle">
            <span class="breathing-label" id="breathing-label">준비</span>
            <span class="breathing-count" id="breathing-count"></span>
          </div>
        </div>
      </div>

      ${
        hasMusic
          ? `
      <div class="now-playing compact" id="now-playing">
        <div class="visualizer" id="visualizer">
          ${Array.from({ length: 5 }, (_, i) => `<span style="--i:${i}"></span>`).join('')}
        </div>
        <div class="track-card compact">
          <div class="track-art">${theme.emoji}</div>
          <div class="track-meta">
            <p class="track-title">${state.track.name}</p>
            <p class="sound-caption">${state.track.subtitle}</p>
          </div>
        </div>
      </div>
      `
          : ''
      }

      <section class="session-mix" aria-label="사운드 믹스">
        <h3 class="session-mix-title">나만의 사운드 믹스</h3>
        <label class="mix-row">
          <span>자연 소리</span>
          <input type="range" id="session-nature-volume" min="0" max="100" value="${Math.round(state.natureVolume * 100)}" />
        </label>
        ${
          hasMusic
            ? `
        <label class="mix-row">
          <span>명상 음악</span>
          <input type="range" id="session-music-volume" min="0" max="100" value="${Math.round(state.musicVolume * 100)}" />
        </label>
        `
            : ''
        }
        <label class="mix-row mix-row--bowl">
          <span class="mix-row-label">
            <span>싱잉볼</span>
            <span class="mix-row-hint">없음 ↔ 풍부하게</span>
          </span>
          <input
            type="range"
            id="session-bowl-volume"
            min="0"
            max="100"
            value="${Math.round(state.singingBowlVolume * 100)}"
            aria-valuetext="${state.singingBowlVolume <= 0 ? '싱잉볼 없음' : state.singingBowlVolume >= 0.95 ? '싱잉볼 풍부하게' : `싱잉볼 ${Math.round(state.singingBowlVolume * 100)}%`}"
          />
        </label>
      </section>

      <div class="session-controls">
        <button class="control-btn" id="pause-btn" type="button">일시정지</button>
        <button class="control-btn danger" id="stop-btn" type="button">종료</button>
      </div>

      <div class="progress-ring">
        <svg viewBox="0 0 100 100">
          <circle class="progress-bg" cx="50" cy="50" r="46" />
          <circle class="progress-fill" id="progress-fill" cx="50" cy="50" r="46" />
        </svg>
      </div>
    </div>
    </div>
  `

  const totalSeconds = state.duration * 60
  const progressFill = app.querySelector('#progress-fill')
  const circumference = 2 * Math.PI * 46
  progressFill.style.strokeDasharray = `${circumference}`
  progressFill.style.strokeDashoffset = '0'

  timer = createTimer(
    (remaining) => {
      app.querySelector('#timer-display').textContent = formatTime(remaining)
      const progress = remaining / totalSeconds
      progressFill.style.strokeDashoffset = `${circumference * (1 - progress)}`
    },
    () => finishSession(state.duration),
  )

  if (state.breathingEnabled) {
    breathing = createBreathingGuide((phase, count) => {
      const circle = app.querySelector('#breathing-circle')
      const label = app.querySelector('#breathing-label')
      const countEl = app.querySelector('#breathing-count')
      label.textContent = phase.label
      countEl.textContent = count
      circle.dataset.phase = phase.key
    })
    breathing.start()
  }

  startAmbient(theme.sound, state.natureVolume, { track: state.track })
  if (hasMusic) {
    startMusic(state.track, state.musicVolume)
  }
  startSingingBowl(state.singingBowlVolume, { track: state.track, themeId: theme.id })

  app.querySelector('#session-nature-volume')?.addEventListener('input', (e) => {
    state.natureVolume = Number(e.target.value) / 100
    setNatureVolume(state.natureVolume)
    persistPrefs()
  })

  app.querySelector('#session-music-volume')?.addEventListener('input', (e) => {
    state.musicVolume = Number(e.target.value) / 100
    setMusicVolume(state.musicVolume)
    persistPrefs()
  })

  app.querySelector('#session-bowl-volume')?.addEventListener('input', (e) => {
    state.singingBowlVolume = Number(e.target.value) / 100
    e.target.setAttribute(
      'aria-valuetext',
      state.singingBowlVolume <= 0
        ? '싱잉볼 없음'
        : state.singingBowlVolume >= 0.95
          ? '싱잉볼 풍부하게'
          : `싱잉볼 ${Math.round(state.singingBowlVolume * 100)}%`,
    )
    setSingingBowlVolume(state.singingBowlVolume, { track: state.track, themeId: theme.id })
    persistPrefs()
  })

  timer.start(totalSeconds)

  app.querySelector('#session-back-btn')?.addEventListener('click', goSetupFromSession)

  app.querySelector('#pause-btn').addEventListener('click', () => {
    const visualizer = app.querySelector('#visualizer')
    if (timer.isPaused()) {
      timer.resume()
      breathing?.start()
      resumeNature(state.natureVolume)
      if (hasMusic) resumeMusic()
      if (state.singingBowlVolume > 0) resumeSingingBowl()
      visualizer?.classList.remove('paused')
      app.querySelector('#pause-btn').textContent = '일시정지'
    } else {
      timer.pause()
      breathing?.stop()
      pauseNature()
      if (hasMusic) pauseMusic()
      if (state.singingBowlVolume > 0) pauseSingingBowl()
      visualizer?.classList.add('paused')
      app.querySelector('#pause-btn').textContent = '재개'
    }
  })

  app.querySelector('#stop-btn').addEventListener('click', () => {
    const elapsed = state.duration * 60 - timer.getRemaining()
    const minutesCompleted = Math.max(1, Math.round(elapsed / 60))
    stopSession()
    finishSession(minutesCompleted, true)
  })
}

function startSession(trackId = NO_TRACK) {
  state.returnScreen = state.screen
  state.duration = selectedDuration
  selectedTrackId = trackId
  if (trackId === NO_TRACK) {
    state.track = null
  } else {
    state.track = getTrackById(trackId) ?? getTracksForTheme(state.theme.id).find((t) => t.id === trackId) ?? null
  }
  state.screen = 'session'
  pushAppHistory()
  render()
}

function stopSession() {
  timer?.stop()
  breathing?.stop()
  stopAmbient()
  stopMusic()
  stopSingingBowl()
  timer = null
  breathing = null
}

function finishSession(minutesCompleted, early = false) {
  stopSession()
  state.stats = saveSession(minutesCompleted)
  state.screen = state.returnScreen ?? 'setup'
  app.style.removeProperty('--session-accent')
  render()

  if (!early && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('명상 완료', { body: `${minutesCompleted}분간의 명상을 마쳤습니다. 수고하셨습니다!` })
  }
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission()
}

initAppHistory()
render()
