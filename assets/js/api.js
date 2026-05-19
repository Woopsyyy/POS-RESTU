/**
 * Loren Eatery POS — API Client
 * Handles all fetch requests to the PHP backend with offline support
 */

// Auto-detect API base path relative to the current location
// This ensures it works on both Docker (root) and XAMPP (subdirectory)
const getApiBase = () => {
  const path = window.location.pathname;
  // If we are in /admin/ or other subfolders, we need to go up
  if (path.includes('/admin/') || path.endsWith('/admin') || path.includes('/admin/index.html')) {
    return '../api/index.php';
  }
  return 'api/index.php';
};

const API_BASE = getApiBase();

// ── Offline Queue (localStorage) ─────────────────────────
const OFFLINE_KEY = 'loren_offline_orders';

function saveOfflineOrder(orderData) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
  queue.push({ ...orderData, _savedAt: Date.now() });
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
}

function getOfflineOrders() {
  return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
}

function clearOfflineOrders() {
  localStorage.removeItem(OFFLINE_KEY);
}

// ── Core Fetch Helper ─────────────────────────────────────
async function apiFetch(resource, action, options = {}) {
  const url = `${API_BASE}?resource=${resource}&action=${action}`;
  const defaultOpts = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  const fetchOpts = { ...defaultOpts, ...options };

  try {
    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    if (!res.ok && !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`[API] Fetch error for ${resource}/${action}:`, err);
    if (!navigator.onLine) {
      throw new Error('OFFLINE');
    }
    throw err;
  }
}

// ── Menu API ──────────────────────────────────────────────
const MenuAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}?resource=menu&action=list${qs ? '&' + qs : ''}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },
  get: (id) => apiFetch('menu', 'get', { method: 'GET', headers: {} }),
  create: (data)  => apiFetch('menu', 'create', { method: 'POST', body: JSON.stringify(data) }),
  update: (data)  => apiFetch('menu', 'update', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id)    => apiFetch('menu', 'delete', { method: 'POST', body: JSON.stringify({ id }) }),
  toggle: (id)    => apiFetch('menu', 'toggle', { method: 'POST', body: JSON.stringify({ id }) }),
};

// ── Category API ──────────────────────────────────────────
const CategoryAPI = {
  list:   ()     => apiFetch('categories', 'list'),
  create: (data) => apiFetch('categories', 'create', { method: 'POST', body: JSON.stringify(data) }),
  update: (data) => apiFetch('categories', 'update', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id)   => apiFetch('categories', 'delete', { method: 'POST', body: JSON.stringify({ id }) }),
};

// ── Order API ─────────────────────────────────────────────
const OrderAPI = {
  create: (data) => apiFetch('orders', 'create', { method: 'POST', body: JSON.stringify(data) }),

  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}?resource=orders&action=list${qs ? '&' + qs : ''}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },

  get: (id) => {
    const url = `${API_BASE}?resource=orders&action=get&id=${id}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },

  updateStatus: (id, status) =>
    apiFetch('orders', 'status', { method: 'POST', body: JSON.stringify({ id, status }) }),

  cancel: (id) =>
    apiFetch('orders', 'cancel', { method: 'POST', body: JSON.stringify({ id }) }),

  getReady: () => {
    const url = `${API_BASE}?resource=orders&action=ready`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },

  getPendingCount: () => {
    const url = `${API_BASE}?resource=orders&action=pending-count`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },

  history: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}?resource=orders&action=history${qs ? '&' + qs : ''}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },

  exportCSV: (month) => {
    window.location.href = `${API_BASE}?resource=orders&action=export&month=${month}`;
  },
};

// ── Auth API ──────────────────────────────────────────────
const AuthAPI = {
  login:  (username, password) =>
    apiFetch('auth', 'login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => apiFetch('auth', 'logout'),
  check:  () => apiFetch('auth', 'check'),
};

// ── Queue API ─────────────────────────────────────────────
const QueueAPI = {
  display: () => {
    const url = `${API_BASE}?resource=queue&action=display`;
    return fetch(url).then(r => r.json());
  },
  today: () => apiFetch('queue', 'today'),
};

// ── Dashboard API ─────────────────────────────────────────
const DashboardAPI = {
  stats:    () => apiFetch('dashboard', 'stats'),
  activity: (limit = 20) => {
    const url = `${API_BASE}?resource=dashboard&action=activity&limit=${limit}`;
    return fetch(url, { credentials: 'include' }).then(r => r.json());
  },
  revenue:  () => apiFetch('dashboard', 'revenue'),
};

// ── Upload API ────────────────────────────────────────────
const UploadAPI = {
  uploadImage: (formData) => {
    const url = `${API_BASE}?resource=uploads&action=image`;
    return fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    }).then(r => r.json());
  },
};

// ── Connectivity Monitor ──────────────────────────────────
let isOnline = navigator.onLine;
const offlineBanner = document.getElementById('offlineBanner');

function updateOnlineStatus() {
  isOnline = navigator.onLine;
  if (offlineBanner) {
    offlineBanner.classList.toggle('visible', !isOnline);
  }
  if (isOnline) {
    retryOfflineOrders();
  }
}

async function retryOfflineOrders() {
  const pending = getOfflineOrders();
  if (!pending.length) return;

  console.log(`[Loren POS] Retrying ${pending.length} offline order(s)…`);
  for (const order of pending) {
    try {
      await OrderAPI.create(order);
    } catch (e) {
      console.warn('[Loren POS] Retry failed:', e.message);
      return; // stop on first failure
    }
  }
  clearOfflineOrders();
  showToast('✅ Offline orders synced!', 'success');
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── Toast Utility ─────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: '💬' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '💬'}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, duration);
}

// ── Sound Utility ─────────────────────────────────────────
function playSound(id) {
  try {
    const el = document.getElementById(id);
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
  } catch (e) {}
}

// ── Format Helpers ────────────────────────────────────────
function formatPeso(amount) {
  const n = parseFloat(amount) || 0;
  return '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(d = new Date()) {
  return d.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
