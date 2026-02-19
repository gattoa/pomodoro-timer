let workDuration = 25 * 60;
let breakDuration = 5 * 60;

const app = document.getElementById('app');
const appTitle = document.getElementById('app-title');
const timeDisplay = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');

let timeRemaining = workDuration;
let isRunning = false;
let currentMode = 'work';
let intervalId = null;

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateDisplay() {
    const modeLabel = currentMode === 'work' ? 'Focus' : 'Break';
    timeDisplay.textContent = formatTime(timeRemaining);
    appTitle.textContent = modeLabel;
    app.dataset.mode = currentMode;
    startPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
}

function switchMode() {
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? workDuration : breakDuration;
}

function tick() {
    timeRemaining--;
    if (timeRemaining <= 0) {
        switchMode();
    }
    updateDisplay();
}

function startPause() {
    if (isRunning) {
        clearInterval(intervalId);
        intervalId = null;
    } else {
        intervalId = setInterval(tick, 1000);
    }
    isRunning = !isRunning;
    updateDisplay();
}

function reset() {
    clearInterval(intervalId);
    intervalId = null;
    isRunning = false;
    timeRemaining = currentMode === 'work' ? workDuration : breakDuration;
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
settingsToggleBtn.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.toggle('settings-panel--open');
    settingsToggleBtn.textContent = isOpen ? 'Close' : 'Settings';
});

document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('settings-panel--open') && !e.target.closest('.top-bar')) {
        settingsPanel.classList.remove('settings-panel--open');
        settingsToggleBtn.textContent = 'Settings';
    }
});

workInput.addEventListener('change', () => {
    const val = parseInt(workInput.value, 10);
    if (!val || val < 1) return;
    workDuration = val * 60;
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
    if (currentMode === 'break') {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = breakDuration;
        updateDisplay();
    }
});

