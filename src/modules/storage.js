const PREFS_KEY = 'nature-meditation-prefs'

const defaultPrefs = {
  natureVolume: 0.7,
  musicVolume: 0.55,
  breathingEnabled: true,
  singingBowlVolume: 0.45,
  weeklyGoal: 3,
}

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : { ...defaultPrefs }
  } catch {
    return { ...defaultPrefs }
  }
}

export function savePreferences(prefs) {
  const current = loadPreferences()
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }))
}

const STATS_KEY = 'nature-meditation-stats'
const FAVORITES_KEY = 'nature-meditation-favorites'

const defaultStats = {
  totalSessions: 0,
  totalMinutes: 0,
  streak: 0,
  lastSessionDate: null,
  dailyLog: {},
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStartOfWeek(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + mondayOffset)
  return start
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    const stats = raw ? { ...defaultStats, ...JSON.parse(raw) } : { ...defaultStats }
    stats.dailyLog = stats.dailyLog && typeof stats.dailyLog === 'object' ? stats.dailyLog : {}
    return stats
  } catch {
    return { ...defaultStats }
  }
}

export function getWeeklyChartData() {
  const stats = loadStats()
  const dailyLog = stats.dailyLog ?? {}
  const weekStart = getStartOfWeek()
  const todayKey = getDateKey()
  const days = []

  for (let index = 0; index < 7; index += 1) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const key = getDateKey(date)
    const entry = dailyLog[key] ?? { sessions: 0, minutes: 0 }

    days.push({
      key,
      label: WEEKDAY_LABELS[index],
      isToday: key === todayKey,
      sessions: entry.sessions ?? 0,
      minutes: entry.minutes ?? 0,
    })
  }

  return days
}

export function getWeeklySessionTotal() {
  return getWeeklyChartData().reduce((sum, day) => sum + day.sessions, 0)
}

export function isWeeklyGoalAchieved(goal) {
  if (!goal || goal <= 0) return false
  return getWeeklySessionTotal() >= goal
}

export function saveSession(minutesCompleted) {
  const stats = loadStats()
  const today = new Date().toDateString()
  const todayKey = getDateKey()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  let streak = stats.streak
  if (stats.lastSessionDate === today) {
    // same day, keep streak
  } else if (stats.lastSessionDate === yesterday) {
    streak += 1
  } else {
    streak = 1
  }

  const dailyLog = { ...(stats.dailyLog ?? {}) }
  const todayEntry = dailyLog[todayKey] ?? { sessions: 0, minutes: 0 }
  dailyLog[todayKey] = {
    sessions: todayEntry.sessions + 1,
    minutes: todayEntry.minutes + minutesCompleted,
  }

  const updated = {
    totalSessions: stats.totalSessions + 1,
    totalMinutes: stats.totalMinutes + minutesCompleted,
    streak,
    lastSessionDate: today,
    dailyLog,
  }

  localStorage.setItem(STATS_KEY, JSON.stringify(updated))
  return updated
}

export function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveFavorites(ids) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
}

export function isFavorite(trackId) {
  return loadFavorites().includes(trackId)
}

export function toggleFavorite(trackId) {
  const favorites = loadFavorites()
  const index = favorites.indexOf(trackId)
  if (index >= 0) {
    favorites.splice(index, 1)
  } else {
    favorites.unshift(trackId)
  }
  saveFavorites(favorites)
  return favorites
}
