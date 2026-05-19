/**
 * Loren Eatery POS — Cart Module
 * Manages cart state, renders cart items, handles checkout flow
 */

// ── Cart State ────────────────────────────────────────────
const Cart = (() => {
  let items = []; // [{ id, name, price, quantity, emoji }]

  // ── Getters ─────────────────────────────────────────────
  function getItems()   { return [...items]; }
  function getCount()   { return items.reduce((s, i) => s + i.quantity, 0); }
  function getTotal()   { return items.reduce((s, i) => s + i.price * i.quantity, 0); }
  function isEmpty()    { return items.length === 0; }
  function findItem(id) { return items.find(i => i.id === id); }

  // ── Mutations ────────────────────────────────────────────
  function addItem(item) {
    const existing = findItem(item.id);
    if (existing) {
      existing.quantity++;
    } else {
      items.push({ ...item, quantity: 1 });
    }
    _notify();
    return getCount();
  }

  function removeOne(id) {
    const existing = findItem(id);
    if (!existing) return;
    if (existing.quantity > 1) {
      existing.quantity--;
    } else {
      items = items.filter(i => i.id !== id);
    }
    _notify();
  }

  function removeAll(id) {
    items = items.filter(i => i.id !== id);
    _notify();
  }

  function clear() {
    items = [];
    _notify();
  }

  function getQuantity(id) {
    const item = findItem(id);
    return item ? item.quantity : 0;
  }

  // ── Serialize for API ─────────────────────────────────────
  function toAPIPayload() {
    return items.map(i => ({
      menu_item_id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    }));
  }

  // ── Subscribers ──────────────────────────────────────────
  const listeners = new Set();
  function subscribe(fn)   { listeners.add(fn); }
  function unsubscribe(fn) { listeners.delete(fn); }
  function _notify()       { listeners.forEach(fn => fn({ items: getItems(), count: getCount(), total: getTotal() })); }

  return { getItems, getCount, getTotal, isEmpty, findItem, getQuantity,
           addItem, removeOne, removeAll, clear, toAPIPayload,
           subscribe, unsubscribe };
})();

// ── Cart UI Controller ────────────────────────────────────
const CartUI = (() => {
  const pill        = document.getElementById('cartPill');
  const pillCount   = document.getElementById('cartPillCount');
  const pillPrice   = document.getElementById('cartPillPrice');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartSheet   = document.getElementById('cartSheet');
  const cartClose   = document.getElementById('cartClose');
  const cartBody    = document.getElementById('cartBody');
  const cartItemsEl = document.getElementById('cartItems');
  const cartEmpty   = document.getElementById('cartEmpty');
  const cartSubtitle= document.getElementById('cartSubtitle');
  const cartTotal   = document.getElementById('cartTotal');
  const btnCheckout = document.getElementById('btnCheckout');

  let isSheetOpen = false;

  // Subscribe to cart changes
  Cart.subscribe(({ count, total }) => {
    updatePill(count, total);
    if (isSheetOpen) renderCartItems();
  });

  function updatePill(count, total) {
    if (count > 0) {
      pill.classList.add('visible');
      pillCount.textContent = count;
      pillPrice.textContent = formatPeso(total);
    } else {
      pill.classList.remove('visible');
    }
  }

  function openSheet() {
    isSheetOpen = true;
    cartOverlay.classList.add('active');
    cartSheet.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderCartItems();
  }

  function closeSheet() {
    isSheetOpen = false;
    cartOverlay.classList.remove('active');
    cartSheet.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCartItems() {
    const items = Cart.getItems();
    const total = Cart.getTotal();
    const count = Cart.getCount();

    cartSubtitle.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    cartTotal.textContent    = formatPeso(total);
    btnCheckout.disabled     = Cart.isEmpty();

    if (Cart.isEmpty()) {
      cartEmpty.style.display  = 'block';
      cartItemsEl.style.display = 'none';
      return;
    }

    cartEmpty.style.display  = 'none';
    cartItemsEl.style.display = 'block';

    cartItemsEl.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-emoji">${item.emoji || '🍽️'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatPeso(item.price)} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn qty-btn-sub" onclick="Cart.removeOne(${item.id})" aria-label="Decrease">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn qty-btn-add" onclick="Cart.addItem({id:${item.id},name:'${escapeHtml(item.name).replace(/'/g,"\\'")}',price:${item.price},emoji:'${item.emoji || '🍽️'}'})" aria-label="Increase">+</button>
        </div>
        <div class="cart-item-subtotal">${formatPeso(item.price * item.quantity)}</div>
        <button class="cart-remove-btn" onclick="Cart.removeAll(${item.id})" aria-label="Remove item">✕</button>
      </div>
    `).join('');
  }

  // Event listeners
  pill?.addEventListener('click', openSheet);
  pill?.addEventListener('keypress', e => { if (e.key === 'Enter') openSheet(); });
  cartClose?.addEventListener('click', closeSheet);
  cartOverlay?.addEventListener('click', closeSheet);

  btnCheckout?.addEventListener('click', () => {
    if (!Cart.isEmpty()) {
      closeSheet();
      CheckoutFlow.open();
    }
  });

  return { openSheet, closeSheet, renderCartItems };
})();

// ── Checkout Flow ─────────────────────────────────────────
const CheckoutFlow = (() => {
  const modal         = document.getElementById('checkoutModal');
  const closeBtn      = document.getElementById('checkoutClose');
  const backBtn       = document.getElementById('checkoutBack');
  const finalizeBtn   = document.getElementById('btnFinalize');
  const customerInput = document.getElementById('customerName');
  const paymentInput  = document.getElementById('paymentInput');
  const changeRow     = document.getElementById('changeRow');
  const payChange     = document.getElementById('payChange');
  const payOrderTotal = document.getElementById('payOrderTotal');
  const paymentError  = document.getElementById('paymentError');
  const quickPay      = document.getElementById('quickPay');
  const rcptItems     = document.getElementById('rcptItems');
  const rcptSubtotal  = document.getElementById('rcptSubtotal');
  const rcptTotal     = document.getElementById('rcptTotal');
  const rcptDate      = document.getElementById('rcptDate');
  const rcptQueue     = document.getElementById('rcptQueue');
  const waitTime      = document.getElementById('waitTime');

  function open() {
    updateReceipt();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    customerInput?.focus();
  }

  function close() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    paymentError.textContent = '';
  }

  function updateReceipt() {
    const items = Cart.getItems();
    const total = Cart.getTotal();

    // Date
    const now = new Date();
    if (rcptDate) rcptDate.textContent = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (rcptQueue) rcptQueue.textContent = 'Q: ---';

    // Items
    if (rcptItems) {
      rcptItems.innerHTML = items.map(i => `
        <div class="receipt-item">
          <span class="receipt-item-name">${escapeHtml(i.name)}</span>
          <span class="receipt-item-qty">x${i.quantity}</span>
          <span class="receipt-item-price">${formatPeso(i.price * i.quantity)}</span>
        </div>
      `).join('');
    }

    // Totals
    if (rcptSubtotal) rcptSubtotal.textContent = formatPeso(total);
    if (rcptTotal)    rcptTotal.textContent     = formatPeso(total);
    if (payOrderTotal) payOrderTotal.textContent = formatPeso(total);

    // Quick-pay shortcuts (round up to common denominations)
    const denominations = [50, 100, 200, 500, 1000];
    const suggestions = denominations.filter(d => d >= total);
    if (total > 0) suggestions.unshift(Math.ceil(total));

    if (quickPay) {
      const unique = [...new Set(suggestions)].slice(0, 5);
      quickPay.innerHTML = unique.map(d => `
        <button class="quick-pay-btn" onclick="document.getElementById('paymentInput').value='${d}';CheckoutFlow.calcChange()">
          ₱${d}
        </button>
      `).join('');
    }

    // Wait time
    const itemCount = Cart.getCount();
    const wait = Math.max(5, Math.min(30, itemCount * 2));
    if (waitTime) waitTime.textContent = `~${wait} mins`;
  }

  function calcChange() {
    const total   = Cart.getTotal();
    const payment = parseFloat(paymentInput?.value || 0);

    if (!payment || payment <= 0) {
      changeRow.style.display  = 'none';
      paymentError.textContent = '';
      return;
    }

    if (payment < total) {
      changeRow.style.display  = 'none';
      paymentError.textContent = `⚠️ Insufficient! Short by ${formatPeso(total - payment)}`;
      finalizeBtn.disabled = true;
      return;
    }

    paymentError.textContent = '';
    payChange.textContent    = formatPeso(payment - total);
    changeRow.style.display  = 'flex';
    finalizeBtn.disabled     = false;
  }

  async function finalize() {
    const name    = customerInput?.value?.trim();
    const total   = Cart.getTotal();
    const payment = parseFloat(paymentInput?.value || 0);

    if (!name) {
      customerInput?.focus();
      customerInput?.classList.add('shake');
      setTimeout(() => customerInput?.classList.remove('shake'), 500);
      showToast('Please enter your name.', 'error');
      return;
    }

    if (payment < total) {
      showToast('Payment is insufficient.', 'error');
      return;
    }

    finalizeBtn.disabled = true;
    finalizeBtn.textContent = '⏳ Processing…';

    const orderPayload = {
      customer_name:  name,
      items:          Cart.toAPIPayload(),
      total_amount:   total,
      payment_amount: payment,
    };

    try {
      let result;
      if (!navigator.onLine) {
        saveOfflineOrder(orderPayload);
        result = {
          data: {
            queue_number:   'OFFLINE',
            customer_name:  name,
            total_amount:   total,
            change_amount:  payment - total,
            estimated_wait: Math.max(5, Cart.getCount() * 2),
          }
        };
        showToast('📴 Saved offline. Will sync when connected.', 'info');
      } else {
        result = await OrderAPI.create(orderPayload);
        if (!result.success) throw new Error(result.error || 'Unknown error');
        playSound('sndSuccess');
      }

      close();
      SuccessModal.show(result.data);
      Cart.clear();
      // Refresh menu card qty badges
      document.querySelectorAll('.menu-card').forEach(c => c.classList.remove('in-cart'));
      document.querySelectorAll('.menu-card-qty-badge').forEach(b => b.textContent = '0');

    } catch (err) {
      finalizeBtn.disabled = false;
      finalizeBtn.textContent = '🎉 Place Order';
      showToast(`Error: ${err.message}`, 'error');
      playSound('sndError');
    }
  }

  // Events
  closeBtn?.addEventListener('click', close);
  backBtn?.addEventListener('click', () => { close(); CartUI.openSheet(); });
  modal?.addEventListener('click', e => { if (e.target === modal) close(); });
  paymentInput?.addEventListener('input', calcChange);
  finalizeBtn?.addEventListener('click', finalize);

  return { open, close, calcChange };
})();

// ── Success Modal ─────────────────────────────────────────
const SuccessModal = (() => {
  const modal       = document.getElementById('successModal');
  const queueNumEl  = document.getElementById('successQueueNumber');
  const nameEl      = document.getElementById('successName');
  const totalEl     = document.getElementById('successTotal');
  const changeEl    = document.getElementById('successChange');
  const waitEl      = document.getElementById('successWait');
  const newOrderBtn = document.getElementById('btnNewOrder');

  function show(orderData) {
    if (queueNumEl) queueNumEl.textContent  = orderData.queue_number  || '---';
    if (nameEl)     nameEl.textContent      = orderData.customer_name || '---';
    if (totalEl)    totalEl.textContent     = formatPeso(orderData.total_amount);
    if (changeEl)   changeEl.textContent    = formatPeso(orderData.change_amount);
    if (waitEl)     waitEl.textContent      = `~${orderData.estimated_wait || 10} mins`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSound('sndOrder');
  }

  function close() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  newOrderBtn?.addEventListener('click', close);
  modal?.addEventListener('click', e => { if (e.target === modal) close(); });

  return { show, close };
})();

// ── Utility ───────────────────────────────────────────────
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}
