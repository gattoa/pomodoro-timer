// Hourglass fill renderer. Reads --fill-pct (0..1) plus --fill-color-start
// and --fill-color-end from .main, lerps the body color based on where the
// surface sits relative to UI landmarks, and paints a flat surface that
// glides smoothly between tick targets.

const TICK_SECONDS = 1.0;
const SNAP_THRESHOLD_PX = 80;

function parseColor(c) {
    if (!c) return [128, 128, 128];
    c = c.trim();
    if (c.startsWith('#')) {
        const h = c.slice(1);
        if (h.length === 3) return h.split('').map(x => parseInt(x + x, 16));
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    }
    const m = c.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}

function mix(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
    ];
}

function rgb(c) {
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function initWater(canvas, mainEl, appEl) {
    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let width = 0, height = 0;
    const t0 = performance.now();
    // Color-progress curve inside the ramp window. 1.0 = linear; >1 biases
    // toward the end (urgency builds slowly then accelerates).
    const COLOR_RAMP_POWER = 1.3;

    // Smooth level interpolation: --fill-pct only updates each tick (~1s).
    // We lerp linearly from the previous target to the new target over
    // TICK_SECONDS so drainage reads as continuous flow.
    let displayLevel = null;
    let fromLevel = null;
    let toLevel = null;
    let segmentStart = 0;

    function resize() {
        dpr = window.devicePixelRatio || 1;
        const r = canvas.getBoundingClientRect();
        width = r.width;
        height = r.height;
        canvas.width = Math.max(1, Math.round(r.width * dpr));
        canvas.height = Math.max(1, Math.round(r.height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getTargetLevel() {
        const cs = getComputedStyle(mainEl);
        const pct = parseFloat(cs.getPropertyValue('--fill-pct')) || 0;
        return height * (1 - pct);
    }

    function getSmoothLevel(t) {
        const target = getTargetLevel();
        if (displayLevel === null) {
            displayLevel = fromLevel = toLevel = target;
            segmentStart = t;
            return displayLevel;
        }
        if (Math.abs(target - toLevel) > 0.5) {
            // Large jumps (mode change, restart) snap rather than slide.
            if (Math.abs(target - displayLevel) > SNAP_THRESHOLD_PX) {
                displayLevel = fromLevel = toLevel = target;
                segmentStart = t;
                return displayLevel;
            }
            fromLevel = displayLevel;
            toLevel = target;
            segmentStart = t;
        }
        const k = Math.min(1, (t - segmentStart) / TICK_SECONDS);
        displayLevel = fromLevel + (toLevel - fromLevel) * k;
        return displayLevel;
    }

    function getLandmarkY(selector) {
        // Returns the bottom edge of the matched element in main-local coords,
        // or null if the element isn't currently in the DOM.
        const el = document.querySelector(selector);
        if (!el) return null;
        const mainRect = mainEl.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        return elRect.bottom - mainRect.top;
    }

    function getColorProgress(level) {
        // Calm period ends when the water surface clears below the bottom of
        // the start-pause button. Color locks at end when it clears below the
        // bottom of the cycle counter. (Falls back gracefully if either
        // landmark isn't rendered yet.)
        const calmEndY = getLandmarkY('#start-pause-btn');
        let lockY = getLandmarkY('.cycle-counter');
        if (lockY == null) lockY = getLandmarkY('.cycle-track');
        if (lockY == null) lockY = height; // bottom of canvas as last resort
        if (calmEndY == null || lockY <= calmEndY) {
            // No usable landmarks — fall back to a smooth viewport mapping.
            return Math.min(1, Math.max(0, level / Math.max(1, height)));
        }
        if (level <= calmEndY) return 0;
        if (level >= lockY) return 1;
        const t = (level - calmEndY) / (lockY - calmEndY);
        return Math.pow(t, COLOR_RAMP_POWER);
    }

    function render() {
        requestAnimationFrame(render);
        const t = (performance.now() - t0) / 1000;
        ctx.clearRect(0, 0, width, height);

        const level = getSmoothLevel(t);
        if (level >= height + 4) return;

        const cs = getComputedStyle(mainEl);
        const startRaw = cs.getPropertyValue('--fill-color-start').trim();
        const endRaw = cs.getPropertyValue('--fill-color-end').trim();
        const startCol = parseColor(startRaw);
        const endCol = parseColor(endRaw);
        const progress = getColorProgress(level);
        const base = mix(startCol, endCol, progress);
        const isDay = appEl.getAttribute('data-theme') === 'day';
        const top = isDay ? mix(base, [255, 255, 255], 0.15) : mix(base, [255, 255, 255], 0.08);
        const bot = isDay ? mix(base, [0, 0, 0], 0.05) : mix(base, [0, 0, 0], 0.12);

        // Gradient spans the water region — top stop at the surface
        // (lightest), bottom stop at the canvas floor (darkest). Matches the
        // original CSS `scaleY(--fill-pct)` behavior.
        const grad = ctx.createLinearGradient(0, level, 0, height);
        grad.addColorStop(0, rgb(top));
        grad.addColorStop(0.4, rgb(base));
        grad.addColorStop(1, rgb(bot));
        ctx.fillStyle = grad;
        ctx.fillRect(0, level, width, height - level);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(mainEl);
    window.addEventListener('resize', resize);

    resize();
    requestAnimationFrame(render);
}
