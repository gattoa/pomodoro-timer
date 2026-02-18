const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

const app = document.getElementById('app');
const timeDisplay = document.getElementById('time-display');
const modeIndicator = document.getElementById('mode-indicator');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');

let timeRemaining = WORK_DURATION;
let isRunning = false;
let currentMode = 'work';
let intervalId = null;

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateDisplay() {
    timeDisplay.textContent = formatTime(timeRemaining);
    modeIndicator.textContent = currentMode === 'work' ? 'Focus' : 'Break';
    app.dataset.mode = currentMode;
    startPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
}

function switchMode() {
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? WORK_DURATION : BREAK_DURATION;
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
    timeRemaining = currentMode === 'work' ? WORK_DURATION : BREAK_DURATION;
    updateDisplay();
}

startPauseBtn.addEventListener('click', startPause);
resetBtn.addEventListener('click', reset);

updateDisplay();
