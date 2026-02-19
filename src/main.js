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
const sessionHistoryEl = document.getElementById('session-history');

let timeRemaining = workDuration;
let isRunning = false;
let currentMode = 'work';
let intervalId = null;

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function renderDots() {
    sessionHistoryEl.innerHTML = '';
    sessionHistory.forEach(session => {
        const dot = document.createElement('div');
        dot.className = `session-dot session-dot--${session.type}`;
        sessionHistoryEl.appendChild(dot);
    });
    const fullDuration = currentMode === 'work' ? workDuration : breakDuration;
    if (isRunning || timeRemaining < fullDuration) {
        const activeDot = document.createElement('div');
        activeDot.className = 'session-dot session-dot--active';
        sessionHistoryEl.appendChild(activeDot);
    }
}

function updateDisplay() {
    const modeLabel = currentMode === 'work' ? 'Focus' : 'Break';
    timeDisplay.textContent = formatTime(timeRemaining);
    appTitle.textContent = modeLabel;
    app.dataset.mode = currentMode;
    startPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
    timeDisplay.classList.toggle('time-display--paused', !isRunning);
    renderDots();
}

function switchMode() {
    sessionHistory.push({ type: currentMode });
    saveHistory();
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? workDuration : breakDuration;
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
        pauseSfx.currentTime = 0;
        pauseSfx.play();
    } else {
        intervalId = setInterval(tick, 1000);
        resumeSfx.currentTime = 0;
        resumeSfx.play();
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
    workDuration = 25 * 60;
    breakDuration = 5 * 60;
    currentMode = 'work';
    timeRemaining = workDuration;
    workInput.value = 25;
    breakInput.value = 5;
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

