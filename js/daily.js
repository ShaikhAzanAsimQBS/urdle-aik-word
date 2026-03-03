// ========================================
// Urdle — Daily Word Selection
// ========================================
// Handles daily word picking based on US Eastern time,
// resets at 9 PM ET each day, and localStorage persistence.

const DAILY_STORAGE_KEY = 'urdle_daily';
const RESET_HOUR = 21; // 9 PM Eastern

/**
 * Get the current Urdle "day" string (YYYY-MM-DD).
 * The day rolls over at 9 PM Eastern — after 9 PM ET
 * we treat it as the next day's puzzle.
 */
function getUSToday() {
    const now = new Date();

    // Get current Eastern hour
    const hourParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(now);
    const easternHour = parseInt(hourParts.find(p => p.type === 'hour').value);

    // If past 9 PM ET, advance to next calendar day
    const dateToFormat = new Date(now);
    if (easternHour >= RESET_HOUR) {
        dateToFormat.setDate(dateToFormat.getDate() + 1);
    }

    const eastern = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(dateToFormat);
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
