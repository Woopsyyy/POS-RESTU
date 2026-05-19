/**
 * Loren Eatery POS — Public Queue Display Controller
 */

// ── State ─────────────────────────────────────────────────
let knownReadyIds = new Set();
let pollInterval = null;

// ── DOM References ────────────────────────────────────────
const readyGrid = document.getElementById('readyGrid');
const preparingList = document.getElementById('preparingList');
const qTime = document.getElementById('qTime');
const qDate = document.getElementById('qDate');

// ── Init ──────────────────────────────────────────────────
function init() {
    startClock();
    loadQueueData();
    
    // Poll every 5 seconds
    pollInterval = setInterval(loadQueueData, 5000);
}

// ── Clock ─────────────────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        qTime.textContent = now.toLocaleTimeString('en-PH', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
        });
        qDate.textContent = now.toLocaleDateString('en-PH', { 
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
        });
    }
    tick();
    setInterval(tick, 1000);
}

// ── Data Loading ──────────────────────────────────────────
async function loadQueueData() {
    try {
        const res = await QueueAPI.display();
        if (res.success) {
            renderQueue(res.data);
        }
    } catch (e) {
        console.error('Queue poll failed');
    }
}

function renderQueue(orders) {
    const ready = orders.filter(o => o.status === 'ready');
    const preparing = orders.filter(o => o.status === 'preparing' || o.status === 'pending');

    // Render Ready
    if (ready.length === 0) {
        readyGrid.innerHTML = '<div class="queue-placeholder">No orders ready yet</div>';
    } else {
        readyGrid.innerHTML = ready.map(o => `
            <div class="queue-token token-ready">
                <div class="token-number">${o.queue_number}</div>
                <div class="token-name">${escapeHtml(o.customer_name)}</div>
            </div>
        `).join('');

        // Check for new ready orders to play sound
        ready.forEach(o => {
            if (!knownReadyIds.has(o.id)) {
                knownReadyIds.add(o.id);
                notifyNewReady();
            }
        });
    }

    // Render Preparing
    if (preparing.length === 0) {
        preparingList.innerHTML = '<div class="queue-placeholder">Kitchen is clear</div>';
    } else {
        preparingList.innerHTML = preparing.map(o => `
            <div class="queue-row animate-fadeInUp">
                <div class="row-number">${o.queue_number}</div>
                <div class="row-name">${escapeHtml(o.customer_name)}</div>
                <div class="row-status">${o.status === 'preparing' ? '⏳' : '📥'}</div>
            </div>
        `).join('');
    }
}

function notifyNewReady() {
    playSound('sndBell');
    showToast('🔔 Order is ready for pickup!', 'success');
}

init();
