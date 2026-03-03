// ========================================
// Urdle — Daily Word Selection
// ========================================
// Handles daily word picking based on US Eastern time,
// 24-hour play lock, and localStorage persistence.

const DAILY_STORAGE_KEY = 'urdle_daily';

/**
 * Get today's "game day" date string in US Eastern timezone (YYYY-MM-DD).
 * The game day resets at 9 PM ET, not midnight.
 * We achieve this by adding 3 hours to the current time before formatting,
 * so 9 PM ET is treated as the start of the next calendar day.
 */
function getUSToday() {
    const now = new Date();
    // Shift forward by 3 hours so the day rolls over at 9 PM ET
    const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const eastern = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(shifted);
    return eastern; // returns YYYY-MM-DD
}

/**
 * Deterministic daily word from the WORDS array.
 * Uses a simple date-based hash seeded from epoch day count.
 */
function getDailyWord() {
    const today = getUSToday();
    // Days since epoch
    const epoch = new Date(today).getTime();
    const dayIndex = Math.floor(epoch / 86400000);
    return WORDS[dayIndex % WORDS.length];
}

/**
 * Load persisted game state for today (if any).
 * Returns { date, attempts, gameOver, won } or null.
 */
function loadDailyState() {
    try {
        const raw = localStorage.getItem(DAILY_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.date !== getUSToday()) return null; // stale
        return data;
    } catch {
        return null;
    }
}

/**
 * Save game state to localStorage.
 */
function saveDailyState(attempts, gameOver, won) {
    const data = {
        date: getUSToday(),
        attempts: attempts, // array of guess strings
        gameOver: gameOver,
        won: won,
    };
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Check if the player has already completed today's puzzle.
 */
function canPlayToday() {
    const state = loadDailyState();
    if (!state) return true;
    return !state.gameOver;
}

/**
 * Mark today as played (called when game ends).
 */
function markPlayed(attempts, won) {
    saveDailyState(attempts, true, won);
}
