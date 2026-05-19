/**
 * Loren Eatery POS — Main Ordering Page Controller
 * Handles menu loading, category filtering, and live clock
 */

// ── State ─────────────────────────────────────────────────
let allMenuItems   = [];
let allCategories  = [];
let activeCategory = 'all';
let searchQuery    = '';

// ── DOM References ────────────────────────────────────────
const menuGrid     = document.getElementById('menuGrid');
const menuLoading  = document.getElementById('menuLoading');
const menuHeading  = document.getElementById('menuHeading');
const categoryNav  = document.getElementById('categoryNav');
const menuSearch   = document.getElementById('menuSearch');
const clockTime    = document.getElementById('clockTime');
const clockDate    = document.getElementById('clockDate');

// ── Category emoji map ────────────────────────────────────
const CATEGORY_EMOJI = {
  'burgers':  '🍔',
  'chicken':  '🍗',
  'fries':    '🍟',
  'pasta':    '🍝',
  'drinks':   '🥤',
  'desserts': '🍨',
  'all':      '🍽️'
};

// Item emoji by keywords
function getItemEmoji(name, categorySlug) {
  const n = (name || '').toLowerCase();
  if (n.includes('burger') || n.includes('yum'))   return '🍔';
  if (n.includes('steak'))                          return '🥩';
  if (n.includes('chicken') || n.includes('joy'))   return '🍗';
  if (n.includes('sandwich'))                        return '🥪';
  if (n.includes('fries') || n.includes('fry'))     return '🍟';
  if (n.includes('spaghetti') || n.includes('pasta') || n.includes('pesto') || n.includes('carbonara')) return '🍝';
  if (n.includes('coke') || n.includes('float'))    return '🥤';
  if (n.includes('juice') || n.includes('orange'))  return '🍊';
  if (n.includes('coffee'))                         return '☕';
  if (n.includes('tea'))                            return '🍵';
  if (n.includes('water'))                          return '💧';
  if (n.includes('sundae') || n.includes('ice cream')) return '🍨';
  if (n.includes('pie'))                            return '🥧';
  if (n.includes('halo'))                           return '🍧';
  return CATEGORY_EMOJI[categorySlug] || '🍽️';
}

// ── Init ──────────────────────────────────────────────────
async function init() {
  startClock();
  await loadCategories();
  await loadMenu();
}

// ── Clock ─────────────────────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    if (clockTime) clockTime.textContent = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    if (clockDate) clockDate.textContent = now.toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ── Load Categories ───────────────────────────────────────
async function loadCategories() {
  try {
    const res = await CategoryAPI.list();
    if (!res.success) return;

    allCategories = res.data || [];
    renderCategories();
  } catch (e) {
    console.warn('[POS] Category load error:', e.message);
  }
}

function renderCategories() {
  allCategories.forEach((cat, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.category = cat.slug;
    
    const icon = cat.icon || CATEGORY_EMOJI[cat.slug] || CATEGORY_EMOJI.all;
    
    btn.innerHTML = `
      <span class="cat-icon">${icon}</span>
      <span class="cat-label">${escapeHtml(cat.name)}</span>
      <span class="cat-count" id="catCount_${cat.slug}">0</span>
    `;
    btn.style.animationDelay = `${idx * 0.06}s`;
    btn.classList.add('animate-fadeInUp');
    btn.addEventListener('click', () => selectCategory(cat.slug, cat.name));
    categoryNav.appendChild(btn);
  });
}

function selectCategory(slug, name) {
  activeCategory = slug;
  menuHeading.textContent = name;

  // Update active button
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.category === slug);
  });

  filterAndRender();
}

// ── Load Menu ─────────────────────────────────────────────
async function loadMenu() {
  menuLoading.style.display = 'flex';

  try {
    const res = await MenuAPI.list({ available: 1 });
    if (!res.success) throw new Error(res.error || 'Failed to load menu');

    allMenuItems = (res.data || []).map(item => ({
      ...item,
      emoji: getItemEmoji(item.name, item.category_slug),
    }));

    updateCategoryCounts();
    filterAndRender();

  } catch (e) {
    console.error('[POS] Menu load error:', e.message);
    menuGrid.innerHTML = `
      <div class="menu-empty">
        <div class="menu-empty-icon">⚠️</div>
        <div class="menu-empty-text">Could not load menu</div>
        <p style="margin-top:.5rem;color:var(--gray-400);font-size:.85rem">${e.message}</p>
        <button class="btn btn-ghost" style="margin-top:1rem" onclick="loadMenu()">Retry</button>
      </div>`;
  } finally {
    menuLoading.style.display = 'none';
  }
}

function updateCategoryCounts() {
  const counts = {};
  allMenuItems.forEach(item => {
    counts[item.category_slug] = (counts[item.category_slug] || 0) + 1;
  });
  Object.entries(counts).forEach(([slug, count]) => {
    const el = document.getElementById(`catCount_${slug}`);
    if (el) el.textContent = count;
  });

  // Total on "All"
  const allCountEl = document.querySelector('[data-category="all"] .cat-count');
  if (!allCountEl) {
    const allBtn = document.querySelector('[data-category="all"]');
    if (allBtn) {
      const span = document.createElement('span');
      span.className = 'cat-count';
      span.textContent = allMenuItems.length;
      allBtn.appendChild(span);
    }
  } else {
    allCountEl.textContent = allMenuItems.length;
  }
}

// ── Filter & Render ───────────────────────────────────────
function filterAndRender() {
  let filtered = allMenuItems;

  if (activeCategory !== 'all') {
    filtered = filtered.filter(i => i.category_slug === activeCategory);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }

  renderMenuCards(filtered);
}

function renderMenuCards(items) {
  if (!items.length) {
    menuGrid.innerHTML = `
      <div class="menu-empty">
        <div class="menu-empty-icon">🔍</div>
        <div class="menu-empty-text">No items found</div>
      </div>`;
    return;
  }

  menuGrid.innerHTML = '';
  items.forEach((item, idx) => {
    const card = createMenuCard(item, idx);
    menuGrid.appendChild(card);
  });
}

function createMenuCard(item, idx) {
  const card = document.createElement('div');
  const qty  = Cart.getQuantity(item.id);

  card.className = `menu-card${item.is_available ? '' : ' unavailable'}${qty > 0 ? ' in-cart' : ''}`;
  card.dataset.id = item.id;
  card.style.animationDelay = `${Math.min(idx * 0.04, 0.4)}s`;

  const imageHtml = item.image_url
    ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}" class="menu-card-img" loading="lazy" />`
    : `<div class="menu-card-emoji">${item.emoji}</div>`;

  card.innerHTML = `
    ${item.is_bestseller ? '<div class="menu-card-badge">⭐ Bestseller</div>' : ''}
    <div class="menu-card-qty-badge">${qty || ''}</div>
    <div class="menu-card-img-wrap">
      ${imageHtml}
      ${!item.is_available ? '<div class="unavailable-overlay">Unavailable</div>' : ''}
    </div>
    <div class="menu-card-body">
      <div class="menu-card-name">${escapeHtml(item.name)}</div>
      <div class="menu-card-desc">${escapeHtml(item.description || '')}</div>
      <div class="menu-card-footer">
        <div class="menu-card-price">${formatPeso(item.price)}</div>
        <div class="menu-card-controls">
          <button class="qty-btn qty-btn-sub" data-action="sub" aria-label="Remove one">−</button>
          <span class="qty-value">${qty || 0}</span>
          <button class="qty-btn qty-btn-add" data-action="add" aria-label="Add to cart">+</button>
        </div>
      </div>
    </div>
  `;

  // Bind buttons
  card.querySelector('[data-action="add"]').addEventListener('click', (e) => {
    e.stopPropagation();
    handleAddToCart(item, card);
  });
  card.querySelector('[data-action="sub"]').addEventListener('click', (e) => {
    e.stopPropagation();
    handleRemoveFromCart(item, card);
  });

  // Tap whole card = add
  card.addEventListener('click', () => {
    if (item.is_available) handleAddToCart(item, card);
  });

  return card;
}

function handleAddToCart(item, card) {
  const itemData = { id: item.id, name: item.name, price: parseFloat(item.price), emoji: item.emoji };
  Cart.addItem(itemData);
  animateAddToCart(card);
  updateCardQty(card, item.id);
}

function handleRemoveFromCart(item, card) {
  Cart.removeOne(item.id);
  updateCardQty(card, item.id);
}

function updateCardQty(card, id) {
  const qty     = Cart.getQuantity(id);
  const qtyVal  = card.querySelector('.qty-value');
  const qtyBadge= card.querySelector('.menu-card-qty-badge');

  if (qtyVal)   qtyVal.textContent   = qty || 0;
  if (qtyBadge) {
    qtyBadge.textContent = qty || '';
    qtyBadge.style.animation = 'none';
    requestAnimationFrame(() => { qtyBadge.style.animation = ''; });
  }

  card.classList.toggle('in-cart', qty > 0);
}

function animateAddToCart(card) {
  const emoji = card.querySelector('.menu-card-emoji, .menu-card-img');
  if (!emoji) return;

  const clone = emoji.cloneNode(true);
  const rect  = emoji.getBoundingClientRect();
  const pill  = document.getElementById('cartPill');
  if (!pill) return;

  clone.style.cssText = `
    position:fixed;top:${rect.top}px;left:${rect.left}px;
    width:${rect.width}px;height:${rect.height}px;
    z-index:9000;pointer-events:none;border-radius:12px;
    animation:flyToCart 0.6s cubic-bezier(0.4,0,0.2,1) both;
  `;
  document.body.appendChild(clone);
  setTimeout(() => clone.remove(), 700);

  // Pulse the cart pill
  pill.style.animation = 'none';
  requestAnimationFrame(() => {
    pill.style.animation = 'pulse 0.4s ease both';
  });
}

// ── Search ────────────────────────────────────────────────
menuSearch?.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  filterAndRender();
});

// ── Category "All" button ─────────────────────────────────
document.getElementById('catAll')?.addEventListener('click', () => {
  selectCategory('all', 'All Items');
});

// ── Boot ──────────────────────────────────────────────────
init();
