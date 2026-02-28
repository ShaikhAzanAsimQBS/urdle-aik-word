// ========================================
// Urdle — Full Game Logic
// ========================================
// Wordle-style engine for 4-letter Urdu words.
// RTL-aware: internal arrays are natural order,
// CSS handles visual RTL rendering.

(function () {
    'use strict';

    // --- Constants ---
    const WORD_LENGTH = 4;
    const MAX_ATTEMPTS = 5;

    // --- State ---
    let secretWord = '';
    let secretLetters = []; // individual letters of secret word
    let currentGuess = [];
    let attempts = [];      // array of guess strings
    let evaluations = [];   // array of evaluation arrays
    let currentRow = 0;
    let gameOver = false;
    let won = false;

    // --- Hint click counter ---
    let hintClickCount = 0;
    const HINT_MAGIC_NUMBER = 18;

    // --- DOM References ---
    let guessContainer;
    let historyContainer;
    let keyboardEl;
    let shareBtn;
    let hintIcon;

    // --- Key state tracking ---
    // Maps letter → best status: 'correct' > 'present' > 'absent'
    const keyStates = {};

    // ========================================
    // Initialization
    // ========================================
    document.addEventListener('DOMContentLoaded', () => {
        guessContainer = document.getElementById('current-guess');
        historyContainer = document.getElementById('history');
        keyboardEl = document.getElementById('keyboard');
        shareBtn = document.getElementById('share-btn');
        hintIcon = document.getElementById('hint-icon');

        // Pick today's word
        secretWord = getDailyWord();
        secretLetters = splitUrdu(secretWord);

        // Clear placeholder content
        clearHistoryPlaceholders();
        resetKeyboard();
        renderEmptyGuess();

        // Try to restore saved state
        const saved = loadDailyState();
        if (saved && saved.date === getUSToday()) {
            restoreState(saved);
        }

        // Bind keyboard clicks
        keyboardEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.key');
            if (!btn) return;
            handleKey(btn.dataset.letter);
        });

        // Bind physical keyboard
        document.addEventListener('keydown', handlePhysicalKey);

        // Share button
        shareBtn.addEventListener('click', shareResult);

        // Hint icon easter egg
        if (hintIcon) {
            hintIcon.addEventListener('click', handleHintClick);
        }

        // Help modal
        const helpBtn = document.getElementById('help-btn');
        const helpModal = document.getElementById('help-modal');
        const modalClose = document.getElementById('modal-close');

        if (helpBtn && helpModal) {
            helpBtn.addEventListener('click', () => {
                helpModal.classList.add('active');
            });

            modalClose.addEventListener('click', () => {
                helpModal.classList.remove('active');
            });

            // Close on overlay click (outside modal content)
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    helpModal.classList.remove('active');
                }
            });
        }
    });

    // ========================================
    // Urdu String Utilities
    // ========================================

    /**
     * Split an Urdu word into individual visual letters.
     * Handles combining characters properly.
     */
    function splitUrdu(word) {
        // Use Array.from for proper Unicode splitting
        const chars = Array.from(word);
        return chars;
    }

    // ========================================
    // Rendering
    // ========================================

    /**
     * Render empty tiles for the current guess.
     */
    function renderEmptyGuess() {
        guessContainer.innerHTML = '';
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile empty';
            tile.textContent = '';
            guessContainer.appendChild(tile);
        }
    }

    /**
     * Update current guess tiles with letters typed so far.
     * Does NOT rebuild DOM — only updates text and classes.
     */
    function updateGuessTiles() {
        const tiles = guessContainer.querySelectorAll('.tile');
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (i < currentGuess.length) {
                tiles[i].textContent = currentGuess[i];
                tiles[i].classList.remove('empty');
                tiles[i].classList.add('filled');
            } else {
                tiles[i].textContent = '';
                tiles[i].classList.add('empty');
                tiles[i].classList.remove('filled');
            }
        }
    }

    /**
     * Remove all hardcoded placeholder history rows.
     * Keep only the header row.
     */
    function clearHistoryPlaceholders() {
        const rows = historyContainer.querySelectorAll('.history-row');
        rows.forEach((row) => row.remove());
    }

    /**
     * Remove all .disabled classes from keyboard keys (clear placeholder state).
     */
    function resetKeyboard() {
        const keys = keyboardEl.querySelectorAll('.key');
        keys.forEach((key) => {
            key.classList.remove('disabled', 'correct', 'present', 'absent');
        });
    }

    /**
     * Add a history row for a completed guess.
     * Inserts right after the header (newest on top, index descending).
     */
    function addHistoryRow(guess, evaluation, rowIndex) {
        const letters = splitUrdu(guess);
        const isWin = evaluation.every((s) => s === 'correct');

        // Count matching letters for the badge
        const matchCount = evaluation.filter((s) => s === 'correct').length;

        const row = document.createElement('div');
        row.className = 'history-row';

        // Row index
        const indexDiv = document.createElement('div');
        indexDiv.className = 'row-index';
        indexDiv.textContent = rowIndex;

        // Mini tiles
        const tilesDiv = document.createElement('div');
        tilesDiv.className = 'tiles';
        for (let i = 0; i < letters.length; i++) {
            const mt = document.createElement('div');
            mt.className = 'mini-tile ' + evaluation[i];
            mt.textContent = letters[i];
            tilesDiv.appendChild(mt);
        }

        // Word
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word' + (isWin ? ' success' : '');
        wordDiv.textContent = guess;

        // Badge
        const badgeDiv = document.createElement('div');
        badgeDiv.className = 'badge';
        badgeDiv.textContent = matchCount;

        row.appendChild(indexDiv);
        row.appendChild(tilesDiv);
        row.appendChild(wordDiv);
        row.appendChild(badgeDiv);

        // Insert after header (first child is header)
        const header = historyContainer.querySelector('.history-header');
        if (header.nextSibling) {
            historyContainer.insertBefore(row, header.nextSibling);
        } else {
            historyContainer.appendChild(row);
        }
    }

    /**
     * Update keyboard key visual states based on evaluations.
     */
    function updateKeyboard(guess, evaluation) {
        const letters = splitUrdu(guess);
        const priority = { correct: 3, present: 2, absent: 1 };

        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const status = evaluation[i];
            const current = keyStates[letter];
            const currentPriority = current ? priority[current] : 0;

            if (priority[status] > currentPriority) {
                keyStates[letter] = status;
            }
        }

        // Apply to DOM
        const keys = keyboardEl.querySelectorAll('.key[data-letter]');
        keys.forEach((key) => {
            const letter = key.dataset.letter;
            if (letter === 'backspace' || letter === 'enter') return;
            const state = keyStates[letter];
            key.classList.remove('disabled', 'correct', 'present', 'absent');
            if (state) {
                key.classList.add(state);
            }
        });
    }

    // ========================================
    // Hint Icon Easter Egg
    // ========================================

    function handleHintClick() {
        hintClickCount++;

        if (hintClickCount === HINT_MAGIC_NUMBER) {
            showToast('Mubarak number(part of it)!!!! if you click aik aur baar toh answer ajaye ga so...', 6000);
        } else if (hintClickCount > HINT_MAGIC_NUMBER) {
            showToast('jawab is ' + secretWord, 6000);
            hintClickCount = 0; // reset so they can trigger it again
        } else {
            showToast('Hiii 🥺 + 🐥 no hints for you sorry!...but i believe in you bohat ❤️ You can do it ', 4000);
        }
    }

    // ========================================
    // Toast Notification
    // ========================================

    function showToast(message, duration) {
        duration = duration || 2000;
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.querySelector('.app-wrapper').appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ========================================
    // Tile Evaluation (Proper Wordle Algorithm)
    // ========================================

    /**
     * Evaluate a guess against the secret word.
     * Two-pass algorithm to handle duplicate letters correctly.
     *
     * Returns an array of 'correct' | 'present' | 'absent'.
     */
    function evaluateGuess(guess) {
        const guessLetters = splitUrdu(guess);
        const result = new Array(WORD_LENGTH).fill('absent');

        // Build frequency map of secret letters
        const freq = {};
        for (const letter of secretLetters) {
            freq[letter] = (freq[letter] || 0) + 1;
        }

        // First pass: mark correct (green)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guessLetters[i] === secretLetters[i]) {
                result[i] = 'correct';
                freq[guessLetters[i]]--;
            }
        }

        // Second pass: mark present (yellow)
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (result[i] === 'correct') continue;
            if (freq[guessLetters[i]] && freq[guessLetters[i]] > 0) {
                result[i] = 'present';
                freq[guessLetters[i]]--;
            }
        }

        return result;
    }

    // ========================================
    // Input Handling
    // ========================================

    function handleKey(letter) {
        if (gameOver) return;

        if (letter === 'backspace') {
            if (currentGuess.length > 0) {
                currentGuess.pop();
                updateGuessTiles();
            }
            return;
        }

        if (letter === 'enter') {
            submitGuess();
            return;
        }

        // Regular letter
        if (currentGuess.length < WORD_LENGTH) {
            currentGuess.push(letter);
            updateGuessTiles();
        }
    }

    /**
     * Map physical keyboard keys to Urdu letters (basic mapping).
     * This handles Enter and Backspace natively.
     */
    function handlePhysicalKey(e) {
        if (gameOver) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            submitGuess();
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            handleKey('backspace');
            return;
        }

        // Check if it's a key on our on-screen keyboard
        const keyBtn = keyboardEl.querySelector(`.key[data-letter="${e.key}"]`);
        if (keyBtn) {
            handleKey(e.key);
        }
    }

    // ========================================
    // Guess Submission
    // ========================================

    function submitGuess() {
        if (currentGuess.length !== WORD_LENGTH) {
            showToast('چار حروف درج کریں');
            return;
        }

        const guessWord = currentGuess.join('');

        // Validate against word list
        if (!WORDS.includes(guessWord)) {
            showToast('یہ لفظ فہرست میں نہیں ہے');
            // Shake animation
            guessContainer.classList.add('shake');
            setTimeout(() => guessContainer.classList.remove('shake'), 500);
            return;
        }

        // Evaluate
        const evaluation = evaluateGuess(guessWord);

        // Animate reveal on current tiles
        const tiles = guessContainer.querySelectorAll('.tile');
        tiles.forEach((tile, i) => {
            setTimeout(() => {
                tile.classList.add('flip');
                setTimeout(() => {
                    tile.classList.add(evaluation[i]);
                    tile.classList.remove('flip');
                }, 250);
            }, i * 150);
        });

        // After animation completes, process result
        const animationTime = WORD_LENGTH * 150 + 300;
        setTimeout(() => {
            // Save to state
            currentRow++;
            attempts.push(guessWord);
            evaluations.push(evaluation);

            // Update keyboard
            updateKeyboard(guessWord, evaluation);

            // Add history row
            addHistoryRow(guessWord, evaluation, currentRow);

            // Check win
            const isWin = evaluation.every((s) => s === 'correct');
            if (isWin) {
                gameOver = true;
                won = true;
                console.log('[Urdle] Game ended — banner will appear in 5s');
                setTimeout(function () { console.log('[Urdle] Showing banner now'); showCountdownBanner(); }, 4000);
                markPlayed(attempts, true);
                showToast('🎉 مبارک ہو!', 3000);
                saveDailyState(attempts, true, true);
                return;
            }

            // Check loss
            if (currentRow >= MAX_ATTEMPTS) {
                gameOver = true;
                won = false;
                console.log('[Urdle] Game ended — banner will appear in 5s');
                setTimeout(function () { console.log('[Urdle] Showing banner now'); showCountdownBanner(); }, 4000);
                markPlayed(attempts, false);
                showToast('khair hogayiiiii ❤️, asal jawab was ' + secretWord, 4000);
                saveDailyState(attempts, true, false);
                return;
            }

            // Reset for next guess
            currentGuess = [];
            renderEmptyGuess();
            saveDailyState(attempts, false, false);
        }, animationTime);
    }

    // ========================================
    // State Restoration
    // ========================================

    function restoreState(saved) {
        attempts = saved.attempts || [];
        gameOver = saved.gameOver || false;
        won = saved.won || false;
        currentRow = attempts.length;

        // Re-evaluate and render all previous guesses
        for (let i = 0; i < attempts.length; i++) {
            const evaluation = evaluateGuess(attempts[i]);
            evaluations.push(evaluation);
            addHistoryRow(attempts[i], evaluation, i + 1);
            updateKeyboard(attempts[i], evaluation);
        }

        if (gameOver) {
            showCountdownBanner();
        } else {
            // Ready for next guess
            currentGuess = [];
            renderEmptyGuess();
        }
    }

    /**
     * Calculate time remaining until midnight US Eastern.
     * Returns { hours, minutes, seconds }.
     */
    function getTimeToMidnight() {
        const now = new Date();
        // Get current US Eastern time components
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const get = (type) => parseInt(parts.find(p => p.type === type).value);

        const h = get('hour');
        const m = get('minute');
        const s = get('second');

        const totalSecondsLeft = ((23 - h) * 3600) + ((59 - m) * 60) + (60 - s);
        return {
            hours: Math.floor(totalSecondsLeft / 3600),
            minutes: Math.floor((totalSecondsLeft % 3600) / 60),
            seconds: totalSecondsLeft % 60,
        };
    }

    /**
     * Show a persistent countdown banner for returning players.
     */
    function showCountdownBanner() {
        // Remove any existing banner
        const existing = document.getElementById('countdown-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'countdown-banner';
        banner.className = 'countdown-banner';

        const msgLine = document.createElement('div');
        msgLine.className = 'countdown-msg';
        msgLine.textContent = 'har waqt is acha ❤️ but you have to wait';

        const timerLine = document.createElement('div');
        timerLine.className = 'countdown-timer';
        timerLine.id = 'countdown-timer';

        const subLine = document.createElement('div');
        subLine.className = 'countdown-sub';
        subLine.textContent = 'to play again';

        banner.appendChild(msgLine);
        banner.appendChild(timerLine);
        banner.appendChild(subLine);

        // Insert after header
        const header = document.getElementById('header');
        header.parentNode.insertBefore(banner, header.nextSibling);

        // Start live countdown
        function tick() {
            const t = getTimeToMidnight();
            const pad = (n) => String(n).padStart(2, '0');
            timerLine.textContent = pad(t.hours) + ':' + pad(t.minutes) + ':' + pad(t.seconds);
        }
        tick();
        setInterval(tick, 1000);
    }

    // ========================================
    // Share Result
    // ========================================

    function shareResult() {
        if (attempts.length === 0) {
            showToast('پہلے کھیلیں!');
            return;
        }

        let text = 'اُردل ' + getUSToday() + '\n';
        text += (won ? currentRow : 'X') + '/' + MAX_ATTEMPTS + '\n\n';

        for (const evaluation of evaluations) {
            let row = '';
            // Build emoji row in natural order (RTL will handle display)
            for (const status of evaluation) {
                if (status === 'correct') row += '🟩';
                else if (status === 'present') row += '🟨';
                else row += '⬜';
            }
            text += row + '\n';
        }

        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text.trim()).then(() => {
                showToast('کلپ بورڈ میں کاپی ہو گیا!');
            }).catch(() => {
                showToast('کاپی نہیں ہو سکا');
            });
        } else {
            showToast('کاپی نہیں ہو سکا');
        }
    }

})();
