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
const savedMsg = document.getElementById('settings-saved-msg');

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
    settingsChanged = true;
    if (currentMode === 'break') {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
        timeRemaining = breakDuration;
        updateDisplay();
    }
});

