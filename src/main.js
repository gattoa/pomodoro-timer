import clavesSrc from '../soundfx/claves.wav?url';
import pauseSrc from '../soundfx/pause.wav?url';
import resumeSrc from '../soundfx/resume.wav?url';
import completedSrc from '../soundfx/completed.wav?url';
import collectedSrc from '../soundfx/collected.wav?url';

const clavesSfx = new Audio(clavesSrc);
const pauseSfx = new Audio(pauseSrc);
const resumeSfx = new Audio(resumeSrc);
const completedSfx = new Audio(completedSrc);
const collectedSfx = new Audio(collectedSrc);

const STORAGE_KEY = 'pomodoro-settings';
const HISTORY_KEY = 'pomodoro-history';
const THEME_KEY = 'pomodoro-theme';

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved) return saved;
    } catch { /* ignore */ }
    return { workMinutes: 25, breakMinutes: 5 };
}

function saveSettings(workMinutes, breakMinutes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workMinutes, breakMinutes }));
}

function clearSettings() {
    localStorage.removeItem(STORAGE_KEY);
}

function loadHistory() {
    try {
        const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
        if (Array.isArray(saved)) return saved;
    } catch { /* ignore */ }
    return [];
}

function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessionHistory));
}

const initialSettings = loadSettings();
let workDuration = initialSettings.workMinutes * 60;
let breakDuration = initialSettings.breakMinutes * 60;
let sessionHistory = loadHistory();

const app = document.getElementById('app');
const appTitle = document.getElementById('app-title');
const timeDisplay = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const mainEl = document.querySelector('.main');
const sessionHistoryEl = document.getElementById('session-history');

let timeRemaining = workDuration;
let isRunning = false;
let currentMode = 'work';
let intervalId = null;

// ── Hourglass color ranges ──
// Start colors match --color-work / --color-break so title and fill are in sync
// Focus: red-orange → deep crimson | Break: teal → emerald green
const HOURGLASS_COLORS = {
    work: { start: [232, 100, 58], end: [204, 44, 44] },
    break: { start: [56, 178, 163], end: [46, 204, 113] },
};

const HOURGLASS_COLORS_DAY = {
    work: { start: [212, 79, 34], end: [168, 58, 24] },
    break: { start: [42, 157, 143], end: [30, 117, 104] },
};

function lerpColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}

function hourglassEase(timeRemaining) {
    // Three phases:
    //   1. Bulk of countdown: barely shifts       (0 → 0.10)
    //   2. 30s → 15s: subtle warmup               (0.10 → 0.25)
    //   3. Final 15s: dramatic, urgent color shift (0.25 → 1.0)
    const total = currentMode === 'work' ? workDuration : breakDuration;

    if (timeRemaining > 30) {
        const t = 1 - ((timeRemaining - 30) / (total - 30));
        return t * 0.10;
    }
    if (timeRemaining > 15) {
        const t = 1 - ((timeRemaining - 15) / 15);
        return 0.10 + t * 0.15;
    }
    // Final 15s: cubic ease-in for aggressive ramp
    const t = 1 - (timeRemaining / 15);
    const eased = t * t * t;
    return 0.25 + eased * 0.75;
}

function updateHourglass() {
    const total = currentMode === 'work' ? workDuration : breakDuration;
    const pct = timeRemaining / total;
    const colorProgress = hourglassEase(timeRemaining);
    const palette = app.dataset.theme === 'day' ? HOURGLASS_COLORS_DAY : HOURGLASS_COLORS;
    const colors = palette[currentMode];
    const color = lerpColor(colors.start, colors.end, colorProgress);
    mainEl.style.setProperty('--fill-pct', pct);
    mainEl.style.setProperty('--fill-color', color);
}

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function renderDots() {
    sessionHistoryEl.innerHTML = '';
    const iconFor = type => type === 'work' ? 'ph-lightbulb' : 'ph-coffee';
    sessionHistory.forEach(session => {
        const dot = document.createElement('i');
        dot.className = `ph ${iconFor(session.type)} session-dot session-dot--${session.type}`;
        sessionHistoryEl.appendChild(dot);
    });
    const fullDuration = currentMode === 'work' ? workDuration : breakDuration;
    if (isRunning || timeRemaining < fullDuration) {
        const activeDot = document.createElement('i');
        activeDot.className = `ph ${iconFor(currentMode)} session-dot session-dot--active`;
        sessionHistoryEl.appendChild(activeDot);
    }
}

function updateDisplay() {
    const modeLabel = currentMode === 'work' ? 'Focus' : 'Break';
    timeDisplay.textContent = formatTime(timeRemaining);
    appTitle.textContent = modeLabel;
    app.dataset.mode = currentMode;
    document.getElementById('icon-play').style.display = isRunning ? 'none' : '';
    document.getElementById('icon-pause').style.display = isRunning ? '' : 'none';
    startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause' : 'Start');
    startPauseBtn.classList.toggle('btn-icon--paused', !isRunning);
    mainEl.classList.toggle('main--paused', !isRunning);
    renderDots();
    updateHourglass();
}

function switchMode() {
    sessionHistory.push({ type: currentMode });
    saveHistory();
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? workDuration : breakDuration;

    // Instant refill: skip the grow-back animation, keep color dissolve
    mainEl.classList.add('hourglass-refill');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            mainEl.classList.remove('hourglass-refill');
        });
    });
}

function tick() {
    timeRemaining--;
    if (timeRemaining > 0 && timeRemaining <= 5) {
        clavesSfx.currentTime = 0;
        clavesSfx.play();
    }
    if (timeRemaining <= 0) {
        completedSfx.currentTime = 0;
        completedSfx.play();
        switchMode();
    }
    updateDisplay();
}

function startPause() {
    if (isRunning) {
        clearInterval(intervalId);
        intervalId = null;
        resumeSfx.currentTime = 0;
        resumeSfx.play();
    } else {
        intervalId = setInterval(tick, 1000);
        pauseSfx.currentTime = 0;
        pauseSfx.play();
    }
    isRunning = !isRunning;
    updateDisplay();
}

function reset() {
    clearInterval(intervalId);
    intervalId = null;
    isRunning = false;
    clearSettings();
    sessionHistory = [];
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(THEME_KEY);
    workDuration = 25 * 60;
    breakDuration = 5 * 60;
    currentMode = 'work';
    timeRemaining = workDuration;
    workInput.value = 25;
    breakInput.value = 5;
    applyTheme('auto');
    updateDisplay();
}

startPauseBtn.addEventListener('click', startPause);
resetBtn.addEventListener('click', reset);

updateDisplay();

// ── Settings ──
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsPanel = document.getElementById('settings-panel');
const workInput = document.getElementById('work-duration-input');
const breakInput = document.getElementById('break-duration-input');
const savedMsg = document.getElementById('settings-saved-msg');

workInput.value = initialSettings.workMinutes;
breakInput.value = initialSettings.breakMinutes;

let settingsChanged = false;
let savedMsgTimeout = null;

function showSavedMsg() {
    clearTimeout(savedMsgTimeout);
    savedMsg.classList.add('settings-saved-msg--visible');
    savedMsgTimeout = setTimeout(() => savedMsg.classList.remove('settings-saved-msg--visible'), 2500);
    collectedSfx.currentTime = 0;
    collectedSfx.play();
    settingsChanged = false;
}

settingsToggleBtn.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.toggle('settings-panel--open');
    settingsToggleBtn.textContent = isOpen ? 'Close' : 'Settings';
    if (!isOpen && settingsChanged) showSavedMsg();
});

document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('settings-panel--open') && !e.target.closest('.top-bar')) {
        settingsPanel.classList.remove('settings-panel--open');
        settingsToggleBtn.textContent = 'Settings';
        if (settingsChanged) showSavedMsg();
    }
});

workInput.addEventListener('change', () => {
    const val = parseInt(workInput.value, 10);
    if (!val || val < 1) return;
    workDuration = val * 60;
    saveSettings(val, breakDuration / 60);
    settingsChanged = true;
    if (currentMode === 'work') {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = workDuration;
        updateDisplay();
    }
});

breakInput.addEventListener('change', () => {
    const val = parseInt(breakInput.value, 10);
    if (!val || val < 1) return;
    breakDuration = val * 60;
    saveSettings(workDuration / 60, val);
    settingsChanged = true;
    if (currentMode === 'break') {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = breakDuration;
        updateDisplay();
    }
});

// ── Theme ──
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');
const themeIconAuto = document.getElementById('theme-icon-auto');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

let currentTheme = localStorage.getItem(THEME_KEY) || 'auto';

function applyTheme(mode) {
    currentTheme = mode;
    let resolved;
    if (mode === 'auto') {
        resolved = prefersDark.matches ? 'night' : 'day';
    } else {
        resolved = mode;
    }

    if (resolved === 'day') {
        app.dataset.theme = 'day';
    } else {
        delete app.dataset.theme;
    }

    themeIconSun.style.display = mode === 'day' ? '' : 'none';
    themeIconMoon.style.display = mode === 'night' ? '' : 'none';
    themeIconAuto.style.display = mode === 'auto' ? '' : 'none';

    updateHourglass();
}

function cycleTheme() {
    const order = ['auto', 'day', 'night'];
    const next = order[(order.indexOf(currentTheme) + 1) % order.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

themeToggleBtn.addEventListener('click', cycleTheme);
prefersDark.addEventListener('change', () => {
    if (currentTheme === 'auto') applyTheme('auto');
});

applyTheme(currentTheme);

