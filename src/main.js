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

// ── Storage Keys ──
const STORAGE_KEY = 'pomodoro-settings';
const HISTORY_KEY = 'pomodoro-history';
const THEME_KEY = 'pomodoro-theme';
const MUTE_KEY = 'pomodoro-muted';

// ── Sound System ──
let isMuted = localStorage.getItem(MUTE_KEY) === 'true';

function playSound(sfx) {
    if (isMuted) return;
    sfx.currentTime = 0;
    sfx.play();
}

// ── Settings Persistence ──
function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved) return saved;
    } catch { /* ignore */ }
    return { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15 };
}

function saveSettings(workMinutes, breakMinutes, longBreakMinutes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workMinutes, breakMinutes, longBreakMinutes }));
}

function clearSettings() {
    localStorage.removeItem(STORAGE_KEY);
}

// ── History Persistence ──
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

// ── State ──
const initialSettings = loadSettings();
let workDuration = initialSettings.workMinutes * 60;
let breakDuration = initialSettings.breakMinutes * 60;
let longBreakDuration = (initialSettings.longBreakMinutes || 15) * 60;
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

// ── Dynamic Favicon ──
const faviconCanvas = document.createElement('canvas');
faviconCanvas.width = 32;
faviconCanvas.height = 32;
const faviconCtx = faviconCanvas.getContext('2d');
let faviconLink = document.querySelector('link[rel="icon"]');
if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
}

function updateFavicon() {
    const isDay = app.dataset.theme === 'day';
    const colors = {
        work: isDay ? '#d44f22' : '#e8643a',
        break: isDay ? '#2a9d8f' : '#38b2a3',
    };
    const color = colors[currentMode];
    faviconCtx.clearRect(0, 0, 32, 32);
    faviconCtx.beginPath();
    faviconCtx.arc(16, 16, 14, 0, Math.PI * 2);
    faviconCtx.fillStyle = color;
    faviconCtx.fill();
    faviconLink.href = faviconCanvas.toDataURL('image/png');
}

// ── Hourglass Color System ──
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
    // Proportional easing: scales with session length
    //   1. First 90%: barely shifts          (0 → 0.10)
    //   2. 90% → 95%: subtle warmup          (0.10 → 0.25)
    //   3. Final 5%: dramatic, urgent shift   (0.25 → 1.0)
    const total = currentMode === 'work' ? workDuration : getBreakDuration();
    const elapsed = total - timeRemaining;
    const progress = elapsed / total;

    if (progress < 0.90) {
        return (progress / 0.90) * 0.10;
    }
    if (progress < 0.95) {
        const t = (progress - 0.90) / 0.05;
        return 0.10 + t * 0.15;
    }
    // Final 5%: cubic ease-in for aggressive ramp
    const t = (progress - 0.95) / 0.05;
    const eased = t * t * t;
    return 0.25 + eased * 0.75;
}

function updateHourglass() {
    const total = currentMode === 'work' ? workDuration : getBreakDuration();
    const pct = timeRemaining / total;
    const colorProgress = hourglassEase(timeRemaining);
    const palette = app.dataset.theme === 'day' ? HOURGLASS_COLORS_DAY : HOURGLASS_COLORS;
    const colors = palette[currentMode];
    const color = lerpColor(colors.start, colors.end, colorProgress);
    mainEl.style.setProperty('--fill-pct', pct);
    mainEl.style.setProperty('--fill-color', color);
}

// ── Long Break Logic ──
function getWorkSessionCount() {
    return sessionHistory.filter(s => s.type === 'work').length;
}

function getBreakDuration() {
    // If transitioning TO break after a 4th work session, use long break
    if (currentMode === 'break') {
        const workCount = getWorkSessionCount();
        if (workCount > 0 && workCount % 4 === 0) return longBreakDuration;
    }
    return breakDuration;
}

// ── Display ──
function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function renderDots() {
    sessionHistoryEl.innerHTML = '';

    // Track work sessions to know when we've hit a group of 4
    let workCount = 0;
    sessionHistory.forEach((session) => {
        if (session.type === 'work') workCount++;
        const dot = document.createElement('i');
        const isLongBreak = session.type === 'break' && workCount > 0 && workCount % 4 === 0;
        const iconWeight = isLongBreak ? 'ph-fill' : 'ph';
        const icon = session.type === 'work' ? 'ph-lightbulb' : 'ph-coffee';
        dot.className = `${iconWeight} ${icon} session-dot session-dot--${session.type}`;

        if (isLongBreak) dot.classList.add('session-dot--long-break');
        sessionHistoryEl.appendChild(dot);
    });

    const fullDuration = currentMode === 'work' ? workDuration : getBreakDuration();
    if (isRunning || timeRemaining < fullDuration) {
        const activeDot = document.createElement('i');
        const entering = renderDots._activeDotRendered ? '' : ' session-dot--entering';
        const isActiveLongBreak = currentMode === 'break' && getWorkSessionCount() > 0 && getWorkSessionCount() % 4 === 0;
        const activeWeight = isActiveLongBreak ? 'ph-fill' : 'ph';
        const activeIcon = currentMode === 'work' ? 'ph-lightbulb' : 'ph-coffee';
        activeDot.className = `${activeWeight} ${activeIcon} session-dot session-dot--active${entering}`;
        sessionHistoryEl.appendChild(activeDot);
        renderDots._activeDotRendered = true;
    } else {
        renderDots._activeDotRendered = false;
    }
}

function updateTabTitle() {
    const modeLabel = currentMode === 'work' ? 'Focus' : 'Break';
    const fullDuration = currentMode === 'work' ? workDuration : getBreakDuration();
    const hasStarted = isRunning || timeRemaining < fullDuration;

    if (!hasStarted) {
        document.title = 'Pomodoro Timer';
    } else if (isRunning) {
        document.title = `${formatTime(timeRemaining)} — ${modeLabel}`;
    } else {
        document.title = `⏸ ${formatTime(timeRemaining)} — ${modeLabel}`;
    }
}

function updateDisplay() {
    const modeLabel = currentMode === 'work' ? 'Focus' : 'Break';
    const isLongBreak = currentMode === 'break' && getWorkSessionCount() > 0 && getWorkSessionCount() % 4 === 0;
    timeDisplay.textContent = formatTime(timeRemaining);
    appTitle.textContent = isLongBreak ? 'Long Break' : modeLabel;
    app.dataset.mode = currentMode;
    document.getElementById('icon-play').style.display = isRunning ? 'none' : '';
    document.getElementById('icon-pause').style.display = isRunning ? '' : 'none';
    startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause' : 'Start');
    startPauseBtn.classList.toggle('btn-icon--paused', !isRunning);
    mainEl.classList.toggle('main--paused', !isRunning);
    renderDots();
    updateHourglass();
    updateTabTitle();
    updateFavicon();
}

// ── Celebration ──
function triggerCelebration() {
    // Flash the hourglass
    mainEl.classList.add('main--celebrating');
    mainEl.addEventListener('animationend', () => {
        mainEl.classList.remove('main--celebrating');
    }, { once: true });

    // Pulse the timer text
    timeDisplay.classList.add('time-display--pulse');
    timeDisplay.addEventListener('animationend', () => {
        timeDisplay.classList.remove('time-display--pulse');
    }, { once: true });
}

// ── Timer Logic ──
function switchMode() {
    sessionHistory.push({ type: currentMode });
    saveHistory();
    currentMode = currentMode === 'work' ? 'break' : 'work';
    renderDots._activeDotRendered = false;
    timeRemaining = currentMode === 'work' ? workDuration : getBreakDuration();

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
        playSound(clavesSfx);
    }
    if (timeRemaining <= 0) {
        playSound(completedSfx);
        triggerCelebration();
        switchMode();
    }
    updateDisplay();
}

function startPause() {
    if (isRunning) {
        clearInterval(intervalId);
        intervalId = null;
        playSound(resumeSfx);
    } else {
        intervalId = setInterval(tick, 1000);
        playSound(pauseSfx);
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
    longBreakDuration = 15 * 60;
    currentMode = 'work';
    timeRemaining = workDuration;
    workInput.value = 25;
    breakInput.value = 5;
    longBreakInput.value = 15;
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
const longBreakInput = document.getElementById('long-break-duration-input');
const savedMsg = document.getElementById('settings-saved-msg');

workInput.value = initialSettings.workMinutes;
breakInput.value = initialSettings.breakMinutes;
longBreakInput.value = initialSettings.longBreakMinutes || 15;

let settingsChanged = false;
let savedMsgTimeout = null;

function showSavedMsg() {
    clearTimeout(savedMsgTimeout);
    savedMsg.classList.add('settings-saved-msg--visible');
    savedMsgTimeout = setTimeout(() => savedMsg.classList.remove('settings-saved-msg--visible'), 2500);
    playSound(collectedSfx);
    settingsChanged = false;
}

function toggleSettings() {
    const isOpen = settingsPanel.classList.toggle('settings-panel--open');
    settingsToggleBtn.textContent = isOpen ? 'Close' : 'Settings';
    if (!isOpen && settingsChanged) showSavedMsg();
}

settingsToggleBtn.addEventListener('click', toggleSettings);

document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('settings-panel--open') && !e.target.closest('.top-bar')) {
        settingsPanel.classList.remove('settings-panel--open');
        settingsToggleBtn.textContent = 'Settings';
        if (settingsChanged) showSavedMsg();
    }
});

function currentLongBreakMinutes() {
    return longBreakDuration / 60;
}

workInput.addEventListener('change', () => {
    const val = parseInt(workInput.value, 10);
    if (!val || val < 1) return;
    workDuration = val * 60;
    saveSettings(val, breakDuration / 60, currentLongBreakMinutes());
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
    saveSettings(workDuration / 60, val, currentLongBreakMinutes());
    settingsChanged = true;
    if (currentMode === 'break') {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = breakDuration;
        updateDisplay();
    }
});

longBreakInput.addEventListener('change', () => {
    const val = parseInt(longBreakInput.value, 10);
    if (!val || val < 1) return;
    longBreakDuration = val * 60;
    saveSettings(workDuration / 60, breakDuration / 60, val);
    settingsChanged = true;
    if (currentMode === 'break' && getWorkSessionCount() % 4 === 0) {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = longBreakDuration;
        updateDisplay();
    }
});

// ── Mute Toggle ──
const muteToggleBtn = document.getElementById('mute-toggle-btn');
const muteIconOn = document.getElementById('mute-icon-on');
const muteIconOff = document.getElementById('mute-icon-off');

function updateMuteUI() {
    muteIconOn.style.display = isMuted ? 'none' : '';
    muteIconOff.style.display = isMuted ? '' : 'none';
}

function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem(MUTE_KEY, isMuted);
    updateMuteUI();
}

muteToggleBtn.addEventListener('click', toggleMute);
updateMuteUI();

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
    updateFavicon();
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

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            startPause();
            break;
        case 'KeyR':
            reset();
            break;
        case 'KeyS':
            toggleSettings();
            break;
        case 'KeyT':
            cycleTheme();
            break;
        case 'KeyM':
            toggleMute();
            break;
    }
});
