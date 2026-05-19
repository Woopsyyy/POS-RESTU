/**
 * Loren Eatery POS — Admin Dashboard Controller
 */

// ── State ─────────────────────────────────────────────────
let currentUser = null;
let activePage = 'orders';
let liveOrdersInterval = null;
let orderStatusFilter = 'all';
let menuCategories = [];

// ── DOM References ────────────────────────────────────────
const loginPage = document.getElementById('loginPage');
const adminLayout = document.getElementById('adminLayout');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

const navItems = document.querySelectorAll('.admin-nav-item');
const pages = document.querySelectorAll('.admin-page');

const ordersGrid = document.getElementById('ordersGrid');
const orderTabs = document.querySelectorAll('.order-tab');
const orderSearch = document.getElementById('orderSearch');
const orderDate = document.getElementById('orderDate');

const menuAdminGrid = document.getElementById('menuAdminGrid');
const menuCatFilter = document.getElementById('menuCatFilter');

// ── Init ──────────────────────────────────────────────────
async function init() {
    console.log('[Admin] Initializing...');
    // Set default date to today
    if (orderDate) orderDate.value = new Date().toISOString().split('T')[0];
    
    // Check session
    try {
        const res = await AuthAPI.check();
        if (res.success) {
            handleLoginSuccess(res.data);
        }
    } catch (e) {
        console.log('No active session');
    }

    setupEventListeners();
}

// ── Event Listeners ───────────────────────────────────────
function setupEventListeners() {
    // Login
    loginForm?.addEventListener('submit', handleLogin);

    // Sidebar Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

    // Password Toggle
    const togglePwBtn = document.getElementById('togglePw');
    const loginPassInput = document.getElementById('loginPass');
    togglePwBtn?.addEventListener('click', () => {
        const type = loginPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassInput.setAttribute('type', type);
        togglePwBtn.textContent = type === 'password' ? '👁' : '🙈';
    });

    // Order Filtering
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            orderTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            orderStatusFilter = tab.dataset.status;
            loadOrders();
        });
    });

    orderSearch?.addEventListener('input', debounce(loadOrders, 300));
    orderDate?.addEventListener('change', loadOrders);

    // Menu Management
    document.getElementById('btnAddItem')?.addEventListener('click', openMenuModal);
    document.getElementById('menuModalClose')?.addEventListener('click', closeMenuModal);
    document.getElementById('menuModalCancel')?.addEventListener('click', closeMenuModal);
    document.getElementById('menuModalSave')?.addEventListener('click', saveMenuItem);

    // Image Upload
    const uploadArea = document.getElementById('imgUploadArea');
    const imageInput = document.getElementById('itemImage');
    
    uploadArea?.addEventListener('click', () => imageInput.click());
    imageInput?.addEventListener('change', handleImageUpload);
    document.getElementById('imgRemoveBtn')?.addEventListener('click', clearImageUpload);

    // Mobile Sidebar
    document.getElementById('btnSidebarToggle')?.addEventListener('click', () => {
        document.getElementById('adminSidebar').classList.toggle('open');
    });

    // History
    document.getElementById('btnHistorySearch')?.addEventListener('click', loadHistory);
    document.getElementById('btnExportCSV')?.addEventListener('click', () => {
        const month = document.getElementById('historyMonth').value;
        if (month) OrderAPI.exportCSV(month);
    });
}

// ── Authentication ────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const btn = document.getElementById('loginBtn');

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    loginError.textContent = '';

    try {
        const res = await AuthAPI.login(username, password);
        if (res.success) {
            handleLoginSuccess(res.data);
        } else {
            loginError.textContent = res.error || 'Login failed';
        }
    } catch (e) {
        loginError.textContent = 'Connection error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

function handleLoginSuccess(user) {
    currentUser = user;
    loginPage.classList.add('hidden');
    adminLayout.classList.remove('hidden');
    
    document.getElementById('adminUname').textContent = user.full_name;
    document.getElementById('adminRole').textContent = user.role === 'super_admin' ? 'Super Admin' : 'Cashier';
    
    navigateTo('orders');
    startLiveUpdates();
}

async function handleLogout() {
    await AuthAPI.logout();
    location.reload();
}

// ── Navigation ───────────────────────────────────────────
function navigateTo(pageId) {
    activePage = pageId;
    
    // Update Sidebar
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });

    // Update Pages
    pages.forEach(page => {
        page.classList.toggle('active', page.id === `page${pageId.charAt(0).toUpperCase() + pageId.slice(1)}`);
    });

    // Update Mobile Title
    const titleMap = { orders: 'Live Orders', menu: 'Menu Mgmt', history: 'Order History', dashboard: 'Dashboard' };
    document.getElementById('mobilePageTitle').textContent = titleMap[pageId] || 'Admin';

    // Load Data
    if (pageId === 'orders') loadOrders();
    if (pageId === 'menu') loadMenuAdmin();
    if (pageId === 'dashboard') loadDashboardStats();
    
    // Close mobile sidebar
    document.getElementById('adminSidebar').classList.remove('open');
}

// ── Orders Management ─────────────────────────────────────
async function loadOrders() {
    const status = orderStatusFilter === 'all' ? '' : orderStatusFilter;
    const search = orderSearch.value;
    const date   = orderDate.value;

    try {
        const res = await OrderAPI.list({ status, search, date });
        if (res.success) {
            renderOrders(res.data);
            updateStatusTabs(res.data);
        }
    } catch (e) {
        console.error('Failed to load orders');
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        ordersGrid.innerHTML = '<div class="table-empty">No orders found for today.</div>';
        return;
    }

    ordersGrid.innerHTML = orders.map(order => `
        <div class="order-admin-card animate-fadeInUp">
            <div class="oa-header">
                <span class="oa-queue">${order.queue_number}</span>
                <span class="oa-time">${new Date(order.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="oa-body">
                <div class="oa-customer">${escapeHtml(order.customer_name)}</div>
                <div class="badge badge-${order.status}">${order.status}</div>
            </div>
            <div class="oa-footer">
                <span class="oa-total">${formatPeso(order.total_amount)}</span>
                <button class="btn btn-ghost btn-sm" onclick="viewOrderDetails(${order.id})">Details</button>
            </div>
        </div>
    `).join('');
}

async function viewOrderDetails(id) {
    const modal = document.getElementById('orderDetailModal');
    const body = document.getElementById('orderDetailBody');
    const footer = document.getElementById('orderDetailFooter');
    
    modal.classList.add('active');
    body.innerHTML = '<div class="admin-loading"><div class="spinner"></div></div>';
    
    try {
        const res = await OrderAPI.get(id);
        if (!res.success) throw new Error(res.error);
        
        const order = res.data;
        document.getElementById('odTitle').textContent = `Order #${order.queue_number}`;
        document.getElementById('odStatus').innerHTML = `<div class="badge badge-${order.status}">${order.status}</div>`;
        
        body.innerHTML = `
            <div class="oa-customer" style="margin-bottom:1rem">${escapeHtml(order.customer_name)}</div>
            <div class="oa-items-list" style="margin-bottom:1.5rem">
                ${order.items.map(item => `
                    <div class="oa-item">
                        <span>${item.quantity}x ${escapeHtml(item.item_name)}</span>
                        <span>${formatPeso(item.subtotal)}</span>
                    </div>
                `).join('')}
                <div class="oa-item" style="border-top:1px solid var(--gray-100); padding-top:8px; margin-top:8px; font-weight:800">
                    <span>Total</span>
                    <span>${formatPeso(order.total_amount)}</span>
                </div>
            </div>
            <div class="payment-row">
                <span>Payment:</span> <span>${formatPeso(order.payment_amount)}</span>
            </div>
            <div class="payment-row">
                <span>Change:</span> <span style="color:var(--status-ready)">${formatPeso(order.change_amount)}</span>
            </div>
        `;

        // Footer Actions
        let actionsHtml = '';
        if (order.status === 'pending') {
            actionsHtml = `<button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'preparing')">Start Preparing</button>`;
        } else if (order.status === 'preparing') {
            actionsHtml = `<button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'ready')">Mark Ready</button>`;
        } else if (order.status === 'ready') {
            actionsHtml = `<button class="btn btn-completed" onclick="updateOrderStatus(${order.id}, 'completed')">Complete Order</button>`;
        }

        if (order.status !== 'completed' && order.status !== 'cancelled') {
            actionsHtml += `<button class="btn btn-danger" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel</button>`;
        }

        footer.innerHTML = actionsHtml;

    } catch (e) {
        body.innerHTML = `<div class="login-error">Error: ${e.message}</div>`;
    }
}

async function updateOrderStatus(id, status) {
    try {
        const res = await OrderAPI.updateStatus(id, status);
        if (res.success) {
            showToast(`Order updated to ${status}`, 'success');
            document.getElementById('orderDetailModal').classList.remove('active');
            loadOrders();
            loadDashboardStats();
            if (status === 'ready') playSound('sndReady');
        }
    } catch (e) {
        showToast('Update failed', 'error');
    }
}

// ── Menu Management ───────────────────────────────────────
async function loadMenuAdmin() {
    try {
        const [menuRes, catRes] = await Promise.all([
            MenuAPI.list(),
            CategoryAPI.list()
        ]);

        if (catRes.success) {
            menuCategories = catRes.data;
            renderCategoryFilter(catRes.data);
            populateCategorySelect(catRes.data);
        }

        if (menuRes.success) {
            renderMenuAdmin(menuRes.data);
        }
    } catch (e) {
        console.error('Failed to load menu');
    }
}

function renderMenuAdmin(items) {
    menuAdminGrid.innerHTML = items.map(item => `
        <div class="item-admin-card">
            ${item.image_url ? `<img src="${item.image_url}" class="ia-img">` : `<div class="ia-no-img">🍽️</div>`}
            <div class="ia-body">
                <div class="ia-name">${escapeHtml(item.name)}</div>
                <div class="page-sub">${escapeHtml(item.category_name)}</div>
                <div class="ia-price">${formatPeso(item.price)}</div>
                <div style="margin-top:8px">
                    <span class="badge ${item.is_available ? 'badge-ready' : 'badge-cancelled'}">${item.is_available ? 'Available' : 'Sold Out'}</span>
                    ${item.is_bestseller ? '<span class="badge badge-bestseller">⭐ Bestseller</span>' : ''}
                </div>
            </div>
            <div class="ia-actions">
                <button class="btn btn-ghost btn-sm" onclick="editMenuItem(${item.id})">Edit</button>
                <button class="btn btn-ghost btn-sm" onclick="toggleAvailability(${item.id})">${item.is_available ? 'Disable' : 'Enable'}</button>
            </div>
        </div>
    `).join('');
}

function openMenuModal() {
    document.getElementById('menuItemModal').classList.add('active');
    document.getElementById('menuModalTitle').textContent = 'Add Menu Item';
    document.getElementById('editItemId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemOrder').value = '0';
    document.getElementById('itemAvailable').checked = true;
    document.getElementById('itemBestseller').checked = false;
    clearImageUpload();
}

function closeMenuModal() {
    document.getElementById('menuItemModal').classList.remove('active');
}

async function editMenuItem(id) {
    openMenuModal();
    document.getElementById('menuModalTitle').textContent = 'Edit Menu Item';
    
    try {
        const res = await MenuAPI.get(id);
        if (res.success) {
            const item = res.data;
            document.getElementById('editItemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemDesc').value = item.description;
            document.getElementById('itemPrice').value = item.price;
            document.getElementById('itemOrder').value = item.sort_order;
            document.getElementById('itemCategory').value = item.category_id;
            document.getElementById('itemAvailable').checked = item.is_available == 1;
            document.getElementById('itemBestseller').checked = item.is_bestseller == 1;
            
            if (item.image_url) {
                showImagePreview(item.image_url);
                document.getElementById('itemImagePath').value = item.image_path;
            }
        }
    } catch (e) {
        showToast('Failed to load item', 'error');
    }
}

async function saveMenuItem() {
    const id = document.getElementById('editItemId').value;
    const data = {
        id: id,
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDesc').value,
        category_id: document.getElementById('itemCategory').value,
        price: document.getElementById('itemPrice').value,
        sort_order: document.getElementById('itemOrder').value,
        is_available: document.getElementById('itemAvailable').checked ? 1 : 0,
        is_bestseller: document.getElementById('itemBestseller').checked ? 1 : 0,
        image_path: document.getElementById('itemImagePath').value
    };

    if (!data.name || !data.price || !data.category_id) {
        showToast('Please fill required fields', 'error');
        return;
    }

    try {
        const res = id ? await MenuAPI.update(data) : await MenuAPI.create(data);
        if (res.success) {
            showToast('Item saved successfully', 'success');
            closeMenuModal();
            loadMenuAdmin();
        } else {
            showToast(res.error, 'error');
        }
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await UploadAPI.uploadImage(formData);
        if (res.success) {
            showImagePreview(res.data.image_url);
            document.getElementById('itemImagePath').value = res.data.filename;
        } else {
            showToast(res.error, 'error');
        }
    } catch (e) {
        showToast('Upload failed', 'error');
    }
}

function showImagePreview(url) {
    document.getElementById('imgUploadArea').style.display = 'none';
    document.getElementById('imgPreviewWrap').style.display = 'block';
    document.getElementById('imgPreview').src = url;
}

function clearImageUpload() {
    document.getElementById('imgUploadArea').style.display = 'block';
    document.getElementById('imgPreviewWrap').style.display = 'none';
    document.getElementById('imgPreview').src = '';
    document.getElementById('itemImagePath').value = '';
    document.getElementById('itemImage').value = '';
}

async function toggleAvailability(id) {
    try {
        const res = await MenuAPI.toggle(id);
        if (res.success) loadMenuAdmin();
    } catch (e) {
        showToast('Failed to toggle', 'error');
    }
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboardStats() {
    try {
        const res = await DashboardAPI.stats();
        if (res.success) {
            const s = res.data;
            document.getElementById('statOrders').textContent = s.orders_today;
            document.getElementById('statRevenue').textContent = formatPeso(s.today_revenue);
            document.getElementById('statPending').textContent = s.status_counts.pending;
            document.getElementById('statCompleted').textContent = s.status_counts.completed;
            document.getElementById('statMenu').textContent = s.menu_items;
            document.getElementById('statQueue').textContent = s.last_queue ? 'A' + String(s.last_queue).padStart(3, '0') : 'None';
            
            // Nav Badge
            const badge = document.getElementById('navBadgePending');
            if (badge) {
                badge.textContent = s.status_counts.pending;
                badge.style.display = s.status_counts.pending > 0 ? 'block' : 'none';
            }
        }
        
        loadActivityLog();
    } catch (e) {}
}

async function loadActivityLog() {
    try {
        const res = await DashboardAPI.activity(10);
        if (res.success) {
            const list = document.getElementById('activityList');
            list.innerHTML = res.data.map(log => `
                <div class="activity-item">
                    <div class="activity-dot"></div>
                    <div class="activity-content">
                        <div class="activity-text"><strong>${log.username}</strong>: ${log.description}</div>
                        <div class="activity-time">${new Date(log.created_at).toLocaleString()}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {}
}

// ── History ───────────────────────────────────────────────
async function loadHistory() {
    const month = document.getElementById('historyMonth').value;
    const search = document.getElementById('historySearch').value;
    const status = document.getElementById('historyStatus').value;

    if (!month) {
        showToast('Please select a month', 'info');
        return;
    }

    try {
        const res = await OrderAPI.history({ month, search, status });
        if (res.success) {
            renderHistoryTable(res.data);
        }
    } catch (e) {}
}

function renderHistoryTable(orders) {
    const body = document.getElementById('historyBody');
    if (!orders.length) {
        body.innerHTML = '<tr><td colspan="8" class="table-empty">No matching records found.</td></tr>';
        return;
    }

    body.innerHTML = orders.map(o => `
        <tr>
            <td><strong>${o.queue_number}</strong></td>
            <td>${escapeHtml(o.customer_name)}</td>
            <td>${o.item_count} items</td>
            <td>${formatPeso(o.total_amount)}</td>
            <td>${formatPeso(o.payment_amount)}</td>
            <td>${formatPeso(o.change_amount)}</td>
            <td><span class="badge badge-${o.status}">${o.status}</span></td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

// ── Helpers ───────────────────────────────────────────────
function startLiveUpdates() {
    if (liveOrdersInterval) clearInterval(liveOrdersInterval);
    liveOrdersInterval = setInterval(() => {
        if (activePage === 'orders') loadOrders();
        if (activePage === 'dashboard') loadDashboardStats();
    }, 5000);
}

function updateStatusTabs(orders) {
    // This could count based on current data
}

function renderCategoryFilter(cats) {
    menuCatFilter.innerHTML = '<button class="cat-filter-btn active" data-cat="all">All</button>' + 
        cats.map(c => `<button class="cat-filter-btn" data-cat="${c.id}">${c.name}</button>`).join('');
}

function populateCategorySelect(cats) {
    const sel = document.getElementById('itemCategory');
    if (sel) {
        sel.innerHTML = '<option value="">Select Category</option>' + 
            cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global modal close for detail modal
document.getElementById('orderDetailClose')?.addEventListener('click', () => {
    document.getElementById('orderDetailModal').classList.remove('active');
});

init();
