// admin.js — API-backed version (PHP + MySQL)

/* ═══════════════════════════════════════════════════════════
   API HELPERS
   ═══════════════════════════════════════════════════════════ */

const API = '/api';

async function apiFetch(endpoint, options = {}) {
  const res = await fetch(API + endpoint, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

function apiGet(endpoint)        { return apiFetch(endpoint); }
function apiPost(endpoint, data) { return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) }); }

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const ADMIN_EMAIL = 'admin@chamilos.com';

const MENU_CATALOG = [
  { id: 'featured-1', name: 'Lavender Flutter Bloom Cake',       price: 1500, image: '/assets/index-featured1.png',  category: 'featured'  },
  { id: 'featured-2', name: 'Crimson Ribbon Delight Cake',        price: 1800, image: '/assets/index-featured2.png',  category: 'featured'  },
  { id: 'featured-3', name: 'Midnight Teddy Celebration Cake',    price: 1450, image: '/assets/index-featured3.png',  category: 'featured'  },
  { id: 'c1',         name: 'Strawberry Milk Cloud Cake',         price: 1500, image: '/assets/menu-signature1.png',  category: 'signature' },
  { id: 'c2',         name: 'Vanilla Bean Celebration Cake',      price: 1350, image: '/assets/menu-signature2.png',  category: 'signature' },
  { id: 'c3',         name: 'Lavender Honey Velvet Cake',         price: 1800, image: '/assets/menu-signature3.png',  category: 'signature' },
  { id: 'c4',         name: 'Blue Waves',                         price: 1450, image: '/assets/fullMenu1.png',        category: 'fullmenu'  },
  { id: 'c5',         name: 'Heartfelt Macapuno Cake',            price: 1550, image: '/assets/fullMenu2.png',        category: 'fullmenu'  },
  { id: 'c6',         name: 'Pastel Garden Mocha Cake',           price: 1500, image: '/assets/fullMenu3.png',        category: 'fullmenu'  },
  { id: 'c7',         name: 'Red Velvet Classic',                 price: 1750, image: '/assets/fullMenu4.png',        category: 'fullmenu'  },
  { id: 'c8',         name: 'Pastel Ribbon Cookies & Cream Cake', price: 1450, image: '/assets/fullMenu5.png',        category: 'fullmenu'  },
  { id: 'c9',         name: 'Monochrome Berry Ribbon Cake',       price: 1500, image: '/assets/fullMenu6.png',        category: 'fullmenu'  },
];

const ORDER_STATUSES  = ['pending', 'processing', 'ready-for-pickup', 'delivered', 'cancelled'];
const ROLE_LEVEL      = { staff: 1, manager: 2, admin: 3 };
const SECTION_MIN_LVL = { dashboard: 1, orders: 1, products: 2, customers: 2, analytics: 2, content: 3, staff: 3, feedbacks: 1 };

/* ═══════════════════════════════════════════════════════════
   MODULE STATE
   ═══════════════════════════════════════════════════════════ */

let CURRENT_USER = null;  // full user object
let CURRENT_ROLE = 'staff';

let _orders   = [];  // cached orders
let _products = {};  // id → product row (overrides + customs)
let _content  = {};  // content key-value map

let currentSection        = 'dashboard';
let currentOrderFilter    = 'pending';
let currentProductTab     = 'featured';
let currentAnalyticsPeriod = 'today';
let currentContentTab     = 'about';

const pendingImages = {};

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP — async init
   ═══════════════════════════════════════════════════════════ */

async function init() {
  // Auth guard
  try {
    const res = await apiGet('/auth.php?action=me');
    if (!res.ok || !res.user) { window.location.href = '/html/login.html'; return; }
    CURRENT_USER = res.user;
    CURRENT_ROLE = res.user.role || 'staff';
    // Only staff+ can access admin
    if (ROLE_LEVEL[CURRENT_ROLE] === undefined) { window.location.href = '/html/login.html'; return; }
  } catch {
    window.location.href = '/html/login.html';
    return;
  }

  // Load products cache
  await loadProducts();

  // Wire up UI
  setupNavigation();
  setupProductTabs();
  setupProductModal();
  setupStaffModal();
  setupAnalyticsTabs();
  setupContentTabs();
  setupAdminAccountBtn();

  document.querySelectorAll('#orderFilterBar .admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => renderOrders(btn.dataset.filter));
  });

  showSection('dashboard');
}

init();

/* ═══════════════════════════════════════════════════════════
   DATA — products cache
   ═══════════════════════════════════════════════════════════ */

async function loadProducts() {
  try {
    const res = await apiGet('/products.php');
    if (!res.ok) return;
    _products = {};
    for (const p of res.products) _products[p.id] = p;
  } catch { /* keep empty */ }
}

function getEffectiveMenu() {
  const base = MENU_CATALOG
    .filter(item => !(_products[item.id]?.is_hidden))
    .map(item => {
      const ov = _products[item.id] || {};
      return {
        ...item,
        name:        ov.name        || item.name,
        price:       ov.price       || item.price,
        tag:         ov.tag         ?? item.tag ?? '',
        customImage: ov.image_data  || '',
        isCustom:    false,
      };
    });

  const customs = Object.values(_products)
    .filter(p => p.is_custom && !p.is_hidden)
    .map(p => ({ ...p, image: p.image_path || p.image || '', customImage: p.image_data || '', isCustom: true }));

  return [...base, ...customs];
}

function getEffectiveMenuByCategory(cat) {
  return getEffectiveMenu().filter(item => item.category === cat);
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════ */

function setupNavigation() {
  document.querySelectorAll('.admin-nav-link[data-min-role]').forEach(btn => {
    if ((ROLE_LEVEL[btn.dataset.minRole] || 1) > (ROLE_LEVEL[CURRENT_ROLE] || 1)) {
      btn.style.display = 'none';
    }
  });

  const headerUser = document.getElementById('headerUser');
  if (headerUser) headerUser.textContent = CURRENT_USER?.name || CURRENT_USER?.email || 'Admin';

  const roleEl = document.getElementById('sidebarRole');
  if (roleEl) {
    const titlePart = CURRENT_USER?.title ? ` — ${CURRENT_USER.title}` : '';
    roleEl.textContent = CURRENT_ROLE.charAt(0).toUpperCase() + CURRENT_ROLE.slice(1) + titlePart;
  }

  document.querySelectorAll('.admin-nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const name   = btn.dataset.section;
      if ((SECTION_MIN_LVL[name] || 1) > (ROLE_LEVEL[CURRENT_ROLE] || 1)) return;

      document.querySelectorAll('.admin-nav-link').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('sectionTitle').textContent =
        btn.textContent.replace(/^[^\w]+/, '').trim();

      showSection(name);
    });
  });

  document.getElementById('adminLogout').addEventListener('click', async () => {
    await apiPost('/auth.php?action=logout', {});
    window.location.href = '/html/login.html';
  });
}

function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => { s.style.display = 'none'; });
  const el = document.getElementById('section-' + name);
  if (el) el.style.display = 'block';
  currentSection = name;

  if (name === 'dashboard') renderDashboard();
  if (name === 'orders')    renderOrders(currentOrderFilter);
  if (name === 'products')  renderProducts(currentProductTab);
  if (name === 'customers') renderCustomers();
  if (name === 'analytics') renderAnalytics(currentAnalyticsPeriod);
  if (name === 'content')   renderContent(currentContentTab);
  if (name === 'staff')     renderStaff();
  if (name === 'feedbacks') renderFeedbacks();
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */

async function renderDashboard() {
  const res = await apiGet('/orders.php');
  if (!res.ok) return;

  _orders = res.orders || [];
  const orders   = _orders;
  const fmtMoney = (v) => parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById('statTotalOrders').textContent = orders.length;
  document.getElementById('statRevenue').textContent     = '₱' + fmtMoney(orders.reduce((s, o) => s + parseFloat(o.total || 0), 0));
  document.getElementById('statPending').textContent     = orders.filter(o => o.status === 'pending').length;
  document.getElementById('statCompleted').textContent   = orders.filter(o => o.status === 'delivered' || o.status === 'completed').length;

  const list   = document.getElementById('recentOrdersList');
  const recent = [...orders].slice(0, 5);
  if (!recent.length) { list.innerHTML = emptyState('No orders yet'); return; }
  list.innerHTML = recent.map(orderCardHtml).join('');
  attachStatusButtons(list);
}

/* ═══════════════════════════════════════════════════════════
   ORDERS
   ═══════════════════════════════════════════════════════════ */

async function renderOrders(filter) {
  currentOrderFilter = filter;

  document.querySelectorAll('#orderFilterBar .admin-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });

  const res = await apiGet('/orders.php');
  if (!res.ok) return;
  _orders = res.orders || [];

  const filtered  = _orders.filter(o => o.status === filter);
  const container = document.getElementById('ordersContainer');

  if (!filtered.length) {
    container.innerHTML = emptyState('No ' + filter + ' orders found');
    return;
  }

  container.innerHTML = filtered.map(orderCardHtml).join('');
  attachStatusButtons(container);
}

function orderCardHtml(order) {
  const d       = new Date(order.date || order.created_at);
  const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const itemsHtml = (order.items || []).map(item => `
    <div class="order-item-row">
      ${item.image ? `<img src="${item.image}" alt="" class="order-item-img" />` : ''}
      <span>${escHtml(item.name)} × ${item.qty || 1}</span>
      <span>₱${(parseFloat(item.price || 0) * parseInt(item.qty || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>`).join('');

  const statusClass = 'order-status--' + (order.status || 'pending').replace(/\s+/g, '-');

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-id">${escHtml(order.id || order.order_ref)}</span>
          <span class="order-status ${statusClass}">${(order.status || 'pending').replace(/-/g, ' ')}</span>
        </div>
        <div class="order-date">${dateStr} · ${timeStr}</div>
      </div>
      <div class="order-card-body">
        <div class="order-customer">
          <strong>${escHtml(order.customer?.name || '—')}</strong><br>
          ${order.customer?.phone ? escHtml(order.customer.phone) + '<br>' : ''}
          ${order.customer?.email ? escHtml(order.customer.email) + '<br>' : ''}
          ${order.deliveryMethod === 'delivery'
            ? 'Delivery: ' + escHtml(order.address || '—')
            : 'Pickup'}
          ${order.preferredDate  ? '<br>Date: ' + escHtml(order.preferredDate) : ''}
          ${order.payment        ? '<br>Payment: ' + escHtml(order.payment)    : ''}
        </div>
        <div class="order-items">${itemsHtml}</div>
        <div class="order-total">Total: <strong>₱${parseFloat(order.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        ${order.cakeMessage         ? `<div class="order-cake-msg">Cake message: "${escHtml(order.cakeMessage)}"</div>`  : ''}
        ${order.specialInstructions ? `<div class="order-instructions">${escHtml(order.specialInstructions)}</div>`      : ''}
      </div>
      <div class="order-card-footer">
        <span>Status:</span>
        <div class="order-status-buttons">
          ${ORDER_STATUSES.filter(s => s !== 'cancelled').map(s => `
            <button class="order-status-btn ${order.status === s ? 'active' : ''}"
                    data-order-id="${escHtml(order.id || order.order_ref)}" data-status="${s}">
              ${s.replace(/-/g, ' ')}
            </button>`).join('')}
          <button class="order-status-btn order-status-btn--cancel ${order.status !== 'pending' ? 'disabled' : ''}"
                  data-order-id="${escHtml(order.id || order.order_ref)}" data-status="cancelled"
                  ${order.status !== 'pending' ? 'disabled' : ''}>
            cancel
          </button>
        </div>
      </div>
    </div>`;
}

function attachStatusButtons(container) {
  container.querySelectorAll('.order-status-btn').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.orderId, btn.dataset.status));
  });
}

async function updateOrderStatus(id, status) {
  const res = await apiPost('/orders.php?action=update_status', { orderId: id, status });
  if (!res.ok) { showNotification(res.error || 'Failed to update status.', 'error'); return; }
  showSection(currentSection);
}

/* ═══════════════════════════════════════════════════════════
   PRODUCTS
   ═══════════════════════════════════════════════════════════ */

function setupProductTabs() {
  document.querySelectorAll('#productTabBar .admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#productTabBar .admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderProducts(tab.dataset.tab);
    });
  });
  document.getElementById('addProductBtn').addEventListener('click', openAddProductModal);
}

function renderProducts(tab) {
  currentProductTab = tab;
  const items     = getEffectiveMenuByCategory(tab);
  const container = document.getElementById('productsContainer');

  if (!items.length) {
    container.innerHTML = `<div style="padding:2rem">${emptyState('No products in this category')}</div>`;
    return;
  }

  container.innerHTML = `<div class="products-grid">${items.map(productCardHtml).join('')}</div>`;

  container.querySelectorAll('.product-img-input').forEach(input => {
    input.addEventListener('change', () => {
      const id   = input.dataset.id;
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        pendingImages[id] = ev.target.result;
        const card = container.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
        if (card) card.querySelector('.product-img').src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  });

  container.querySelectorAll('.product-save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveProductInline(btn.dataset.id, container, btn));
  });

  container.querySelectorAll('.product-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this product from the website?')) return;
      deleteProduct(btn.dataset.id);
    });
  });
}

function productCardHtml(item) {
  const imgSrc = item.customImage || item.image;
  return `
    <div class="product-card" data-id="${escAttr(item.id)}">
      <div class="product-img-wrap">
        <img src="${escAttr(imgSrc)}" alt="${escAttr(item.name)}" class="product-img" />
        <div class="product-img-overlay">
          <label class="product-img-upload-btn">
            Change Image
            <input type="file" accept="image/*" class="product-img-input" data-id="${escAttr(item.id)}" />
          </label>
        </div>
        ${item.tag ? `<span class="product-tag-badge">${escHtml(item.tag)}</span>` : ''}
      </div>
      <div class="product-card-body">
        <input type="text"   class="product-name-input"  value="${escAttr(item.name)}"        placeholder="Product name"   />
        <div class="product-price-row">
          <span class="price-symbol">₱</span>
          <input type="number" class="product-price-input" value="${item.price}"               placeholder="Price" min="0" />
        </div>
        <input type="text"   class="product-tag-input"   value="${escAttr(item.tag || '')}"   placeholder="Tag (optional)" />
        <div class="product-card-actions">
          <button class="admin-btn-primary product-save-btn"   data-id="${escAttr(item.id)}">Save</button>
          <button class="admin-btn-danger  product-delete-btn" data-id="${escAttr(item.id)}">${item.isCustom ? 'Delete' : 'Hide'}</button>
        </div>
      </div>
    </div>`;
}

async function saveProductInline(id, container, btn) {
  const card  = container.querySelector(`.product-card[data-id="${CSS.escape(id)}"]`);
  const name  = card.querySelector('.product-name-input').value.trim();
  const price = Number(card.querySelector('.product-price-input').value);
  const tag   = card.querySelector('.product-tag-input').value.trim();

  if (!name || !price) { showNotification('Name and price are required.', 'warning'); return; }

  const base64   = pendingImages[id] || '';
  const isCustom = !!(_products[id]?.is_custom);

  const res = await apiPost('/products.php?action=upsert', {
    id,
    name,
    price,
    tag,
    category:  _products[id]?.category || currentProductTab,
    imageData: base64,
    isCustom,
  });

  if (!res.ok) { showNotification(res.error || 'Save failed.', 'error'); return; }

  delete pendingImages[id];
  await loadProducts();

  btn.textContent = 'Saved ✓';
  btn.classList.add('saved');
  setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved'); }, 1800);
}

async function deleteProduct(id) {
  const isCustom = !!(_products[id]?.is_custom);
  const action   = isCustom ? 'delete' : 'hide';
  const res      = await apiPost(`/products.php?action=${action}`, { id });
  if (!res.ok) { showNotification(res.error || 'Failed.', 'error'); return; }
  await loadProducts();
  renderProducts(currentProductTab);
}

/* ── Product add modal ── */

function setupProductModal() {
  const modal       = document.getElementById('productModal');
  const imgWrap     = document.getElementById('imgUploadWrap');
  const imgFile     = document.getElementById('productImgFile');
  const preview     = document.getElementById('productImgPreview');
  const placeholder = document.getElementById('imgUploadPlaceholder');
  const imgData     = document.getElementById('productImgData');

  imgWrap.addEventListener('click', e => { if (e.target !== imgFile) imgFile.click(); });

  imgFile.addEventListener('change', () => {
    const file = imgFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      imgData.value             = ev.target.result;
      preview.src               = ev.target.result;
      preview.style.display     = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductBtn').addEventListener('click',  closeProductModal);
  document.getElementById('saveProductBtn').addEventListener('click',    saveNewProduct);
  modal.addEventListener('click', e => { if (e.target === modal) closeProductModal(); });
}

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent      = 'Add Product';
  document.getElementById('editProductId').value               = '';
  document.getElementById('productName').value                 = '';
  document.getElementById('productPrice').value                = '';
  document.getElementById('productTag').value                  = '';
  document.getElementById('productImgData').value              = '';
  document.getElementById('productImgPreview').style.display   = 'none';
  document.getElementById('imgUploadPlaceholder').style.display = 'flex';
  document.getElementById('productCategory').value             = currentProductTab;
  document.getElementById('productModalError').style.display   = 'none';
  document.getElementById('productModal').style.display        = 'flex';
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productImgFile').value       = '';
}

async function saveNewProduct() {
  const name     = document.getElementById('productName').value.trim();
  const price    = Number(document.getElementById('productPrice').value);
  const tag      = document.getElementById('productTag').value.trim();
  const category = document.getElementById('productCategory').value;
  const imgData  = document.getElementById('productImgData').value;
  const errEl    = document.getElementById('productModalError');

  if (!name || !price) {
    errEl.textContent   = 'Name and price are required.';
    errEl.style.display = 'block';
    return;
  }

  const newId = 'custom-' + Date.now();
  const res   = await apiPost('/products.php?action=upsert', {
    id: newId, name, price, tag, category,
    imagePath: imgData ? '' : '/assets/logo.png',
    imageData: imgData,
    isCustom:  true,
  });

  if (!res.ok) {
    errEl.textContent   = res.error || 'Save failed.';
    errEl.style.display = 'block';
    return;
  }

  await loadProducts();
  closeProductModal();

  document.querySelectorAll('#productTabBar .admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === category);
  });
  renderProducts(category);
}

/* ═══════════════════════════════════════════════════════════
   CUSTOMERS
   ═══════════════════════════════════════════════════════════ */

function deriveCustomers(orders) {
  const map = {};
  orders.forEach(o => {
    const key = ((o.customer?.email || o.customer?.phone || o.customer?.name) || 'unknown').toLowerCase();
    if (!map[key]) {
      map[key] = {
        name:      o.customer?.name  || '—',
        phone:     o.customer?.phone || '—',
        email:     o.customer?.email || '—',
        orders:    0,
        total:     0,
        points:    0,
        lastOrder: o.date,
      };
    }
    map[key].orders++;
    map[key].total  += parseFloat(o.total || 0);
    map[key].points += Math.floor(parseFloat(o.total || 0) / 100);
    if (new Date(o.date) > new Date(map[key].lastOrder)) map[key].lastOrder = o.date;
  });
  return map;
}

async function renderCustomers() {
  const res = await apiGet('/orders.php');
  if (!res.ok) return;

  const customers = deriveCustomers(res.orders || []);
  const container = document.getElementById('customersContainer');
  const list      = Object.values(customers).sort((a, b) => b.total - a.total);

  if (!list.length) { container.innerHTML = emptyState('No customers yet'); return; }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th><th>Contact</th><th>Orders</th>
          <th>Total Spent</th><th>Loyalty Pts</th><th>Last Order</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => `
          <tr>
            <td><strong>${escHtml(c.name)}</strong></td>
            <td>
              ${c.phone !== '—' ? `<div>${escHtml(c.phone)}</div>` : ''}
              ${c.email !== '—' ? `<div class="text-muted">${escHtml(c.email)}</div>` : ''}
            </td>
            <td class="text-center">${c.orders}</td>
            <td class="text-purple"><strong>₱${c.total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
            <td class="text-center"><span class="loyalty-badge">${c.points} pts</span></td>
            <td class="text-muted">${new Date(c.lastOrder).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ═══════════════════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════════════ */

function setupAnalyticsTabs() {
  document.querySelectorAll('#analyticsTabBar .admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#analyticsTabBar .admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderAnalytics(tab.dataset.tab);
    });
  });
}

function getOrdersInPeriod(orders, period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return orders.filter(o => new Date(o.date) >= today);
  if (period === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return orders.filter(o => new Date(o.date) >= start);
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return orders.filter(o => new Date(o.date) >= start);
  }
  return orders;
}

async function renderAnalytics(period) {
  currentAnalyticsPeriod = period;

  const res = await apiGet('/orders.php');
  if (!res.ok) return;

  const all      = res.orders || [];
  const orders   = getOrdersInPeriod(all, period);
  const revenue  = orders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const avgOrder = orders.length ? revenue / orders.length : 0;
  const fmtMoney = (v) => parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.getElementById('analyticsStats').innerHTML = `
    <div class="admin-stat-card"><div class="admin-stat-value">${orders.length}</div><div class="admin-stat-label">Orders</div></div>
    <div class="admin-stat-card"><div class="admin-stat-value">₱${fmtMoney(revenue)}</div><div class="admin-stat-label">Revenue</div></div>
    <div class="admin-stat-card"><div class="admin-stat-value">₱${fmtMoney(avgOrder)}</div><div class="admin-stat-label">Avg Order</div></div>
    <div class="admin-stat-card"><div class="admin-stat-value">${orders.filter(o => o.status === 'pending').length}</div><div class="admin-stat-label">Pending</div></div>
    <div class="admin-stat-card"><div class="admin-stat-value">${orders.filter(o => o.status === 'delivered').length}</div><div class="admin-stat-label">Delivered</div></div>`;

  renderPopularProducts(orders);
  renderRevenueChart(orders);
}

function renderPopularProducts(orders) {
  const counts = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      counts[item.name] = (counts[item.name] || 0) + (item.qty || 1);
    });
  });

  const el   = document.getElementById('popularProducts');
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!list.length) { el.innerHTML = emptyState('No data yet'); return; }

  const max = list[0][1];
  el.innerHTML = list.map(([name, qty]) => `
    <div class="popular-row">
      <span class="popular-name">${escHtml(name)}</span>
      <div class="popular-bar-wrap"><div class="popular-bar" style="width:${Math.round(qty / max * 100)}%"></div></div>
      <span class="popular-qty">${qty} sold</span>
    </div>`).join('');
}

function renderRevenueChart(orders) {
  const el = document.getElementById('revenueChart');
  if (!orders.length) { el.innerHTML = emptyState('No data yet'); return; }

  const byDay = {};
  orders.forEach(o => {
    const day = new Date(o.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    byDay[day] = (byDay[day] || 0) + parseFloat(o.total || 0);
  });

  const entries = Object.entries(byDay).slice(-14);
  const max     = Math.max(...entries.map(([, v]) => v), 1);

  el.innerHTML = `
    <div class="bar-chart">
      ${entries.map(([label, val]) => `
        <div class="bar-col">
          <div class="bar-fill" style="height:${Math.round(val / max * 100)}%" title="₱${val.toLocaleString()}"></div>
          <div class="bar-label">${escHtml(label)}</div>
        </div>`).join('')}
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   CONTENT MANAGEMENT
   ═══════════════════════════════════════════════════════════ */

const CONTENT_FIELDS = {
  about: [
    { key: 'aboutOwnerName',  label: 'Owner Name',        type: 'text',     ph: 'e.g. Cynthia Ballion' },
    { key: 'aboutOwnerRole',  label: 'Owner Title/Role',  type: 'text',     ph: 'e.g. Owner & Lead Cake Designer' },
    { key: 'aboutHeading',    label: 'Section Heading',   type: 'text',     ph: 'e.g. It started with one birthday cake' },
    { key: 'aboutBio1',       label: 'Story Paragraph 1', type: 'textarea', ph: 'First paragraph of your story...' },
    { key: 'aboutBio2',       label: 'Story Paragraph 2', type: 'textarea', ph: 'Second paragraph...' },
    { key: 'aboutBio3',       label: 'Story Paragraph 3', type: 'textarea', ph: 'Third paragraph...' },
    { key: 'aboutStat1Val',   label: 'Stat 1 Value',      type: 'text',     ph: 'e.g. 10+' },
    { key: 'aboutStat1Lbl',   label: 'Stat 1 Label',      type: 'text',     ph: 'e.g. Orders per week' },
    { key: 'aboutStat2Val',   label: 'Stat 2 Value',      type: 'text',     ph: 'e.g. 4.9★' },
    { key: 'aboutStat2Lbl',   label: 'Stat 2 Label',      type: 'text',     ph: 'e.g. Average client rating' },
    { key: 'aboutStat3Val',   label: 'Stat 3 Value',      type: 'text',     ph: 'e.g. 4 yrs' },
    { key: 'aboutStat3Lbl',   label: 'Stat 3 Label',      type: 'text',     ph: 'e.g. Of sweet celebrations' },
  ],
  contact: [
    { key: 'contactAddress',  label: 'Address',            type: 'text',     ph: 'e.g. Diamond St., Brgy. Pembo, Makati City' },
    { key: 'contactPhone',    label: 'Phone',              type: 'text',     ph: 'e.g. +63 916 490 1535' },
    { key: 'contactEmail',    label: 'Email',              type: 'text',     ph: 'e.g. Chamilopastry@gmail.com' },
    { key: 'contactHours',    label: 'Studio Hours',       type: 'textarea', ph: 'e.g. Tue–Sun: 10AM–10PM...' },
  ],
};

function setupContentTabs() {
  document.querySelectorAll('#contentTabBar .admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#contentTabBar .admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderContent(tab.dataset.tab);
    });
  });
}

async function renderContent(tab) {
  currentContentTab = tab;

  const res       = await apiGet('/content.php');
  const content   = res.ok ? (res.content || {}) : {};
  const fields    = CONTENT_FIELDS[tab] || [];
  const container = document.getElementById('contentContainer');

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">${tab === 'about' ? 'About Page' : 'Contact Page'} — edits apply live on save</div>
      <div class="content-form">
        ${fields.map(f => `
          <div class="form-group">
            <label>${f.label}</label>
            ${f.type === 'textarea'
              ? `<textarea class="form-control form-textarea" data-key="${f.key}" placeholder="${escAttr(f.ph)}" rows="3">${escHtml(content[f.key] || '')}</textarea>`
              : `<input type="text" class="form-control" data-key="${f.key}" placeholder="${escAttr(f.ph)}" value="${escAttr(content[f.key] || '')}" />`}
          </div>`).join('')}
        <div style="display:flex;align-items:center;gap:0.8rem;">
          <button class="admin-btn-primary" id="saveContentBtn">Save Changes</button>
          <span id="contentSaveMsg" style="display:none;color:#3a9e6a;font-size:0.84rem;font-weight:600;">Saved ✓</span>
        </div>
      </div>
    </div>`;

  document.getElementById('saveContentBtn').addEventListener('click', async () => {
    const payload = {};
    container.querySelectorAll('[data-key]').forEach(el => { payload[el.dataset.key] = el.value; });

    const res = await apiPost('/content.php', payload);
    const msg = document.getElementById('contentSaveMsg');
    msg.textContent   = res.ok ? 'Saved ✓' : (res.error || 'Save failed.');
    msg.style.display = 'inline';
    setTimeout(() => { msg.style.display = 'none'; }, 2200);
  });
}

/* ═══════════════════════════════════════════════════════════
   STAFF
   ═══════════════════════════════════════════════════════════ */

async function renderStaff() {
  const res       = await apiGet('/staff.php');
  const container = document.getElementById('staffContainer');

  if (!res.ok) { container.innerHTML = emptyState('Failed to load staff.'); return; }

  const staff = res.staff || [];

  const adminRow = `
    <tr>
      <td><strong>Chamilo's Admin</strong></td>
      <td class="text-muted">—</td>
      <td class="text-muted">${ADMIN_EMAIL}</td>
      <td><span class="role-badge role-badge--admin">Admin</span></td>
      <td class="text-muted" style="font-size:0.78rem;">Built-in account</td>
    </tr>`;

  const rows = staff
    .filter(s => s.email !== ADMIN_EMAIL)
    .map(s => `
      <tr>
        <td><strong>${escHtml(s.name)}</strong></td>
        <td class="text-muted">${escHtml(s.title || '—')}</td>
        <td class="text-muted">${escHtml(s.email)}</td>
        <td><span class="role-badge role-badge--${s.role}">${s.role}</span></td>
        <td>
          <button class="admin-btn-danger admin-btn-sm delete-staff-btn" data-email="${escAttr(s.email)}">Remove</button>
        </td>
      </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>${adminRow}${rows}</tbody>
    </table>`;

  container.querySelectorAll('.delete-staff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove ' + btn.dataset.email + '?')) return;
      const res = await apiPost('/staff.php?action=delete', { email: btn.dataset.email });
      if (!res.ok) { showNotification(res.error || 'Failed to remove.', 'error'); return; }
      renderStaff();
    });
  });
}

function setupStaffModal() {
  const modal = document.getElementById('staffModal');

  document.getElementById('addStaffBtn').addEventListener('click', () => {
    ['staffName', 'staffEmail', 'staffPassword', 'staffTitle'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('staffRole').value              = 'staff';
    document.getElementById('staffModalError').style.display = 'none';
    modal.style.display = 'flex';
  });

  document.getElementById('closeStaffModal').addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('cancelStaffBtn').addEventListener('click',  () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('saveStaffBtn').addEventListener('click', async () => {
    const name     = document.getElementById('staffName').value.trim();
    const email    = document.getElementById('staffEmail').value.trim().toLowerCase();
    const password = document.getElementById('staffPassword').value;
    const title    = document.getElementById('staffTitle').value.trim();
    const role     = document.getElementById('staffRole').value;
    const errEl    = document.getElementById('staffModalError');

    if (!name || !email || !password) {
      errEl.textContent   = 'Name, email and password are required.';
      errEl.style.display = 'block';
      return;
    }

    const res = await apiPost('/staff.php?action=create', { name, email, password, title, role });
    if (!res.ok) {
      errEl.textContent   = res.error || 'Failed to add member.';
      errEl.style.display = 'block';
      return;
    }

    modal.style.display = 'none';
    renderStaff();
  });
}

/* ═══════════════════════════════════════════════════════════
   ADMIN ACCOUNT MODAL
   ═══════════════════════════════════════════════════════════ */

function setupAdminAccountBtn() {
  const btn = document.getElementById('adminAccountBtn');
  if (!btn) return;

  const nameEl = document.getElementById('headerUser');
  if (nameEl) nameEl.textContent = CURRENT_USER?.name || CURRENT_USER?.email || 'Admin';

  btn.addEventListener('click', openAdminAccountModal);
}

function openAdminAccountModal() {
  let overlay = document.getElementById('adminAccountModal');

  if (!overlay) {
    overlay           = document.createElement('div');
    overlay.id        = 'adminAccountModal';
    overlay.className = 'account-modal-overlay';
    overlay.innerHTML = `
      <div class="account-modal-card">
        <div class="account-modal-header">
          <h2 class="account-modal-title">My Account</h2>
          <button class="account-modal-close" id="adminAccModalClose" type="button">✕</button>
        </div>
        <div class="account-modal-body">
          <div class="account-avatar">
            <div class="account-avatar-ring"></div>
            <div class="account-avatar-name" id="adminAccDisplayName">Admin</div>
            <div class="account-role-badge admin">Admin — Highest Authority</div>
          </div>

          <div class="account-section-title">Personal Information</div>
          <div class="account-field">
            <label>Display Name</label>
            <div class="account-field-row">
              <input type="text" id="adminAccName" placeholder="e.g. Chamilo Admin" />
            </div>
          </div>
          <div class="account-field">
            <label>Email Address</label>
            <div class="account-field-row">
              <input type="email" id="adminAccEmail" readonly />
            </div>
          </div>
          <div class="account-field">
            <label>Phone Number</label>
            <div class="account-field-row">
              <input type="tel" id="adminAccPhone" placeholder="e.g. +63 9XX XXX XXXX" />
            </div>
          </div>

          <div class="account-section-title">Security</div>
          <div class="account-field">
            <label>New Password <small>(leave blank to keep current)</small></label>
            <div class="account-field-row">
              <input type="password" id="adminAccPassword" placeholder="New password" />
              <button class="account-show-toggle" id="adminAccTogglePwd" type="button" title="Show/hide">Show</button>
            </div>
          </div>

          <div class="account-section-title">Role &amp; Access</div>
          <div style="font-size:0.85rem;color:#7a6675;padding:0.5rem 0">
            <strong>Role:</strong> Administrator (Level 3 — Full Access)<br>
            <strong>Permissions:</strong> Dashboard, Orders, Products, Customers, Analytics, Content, Staff
          </div>

          <button class="account-save-btn" id="adminAccSaveBtn" type="button">Save Changes</button>
          <div class="account-saved-badge" id="adminAccSavedBadge">✓ Changes saved successfully</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('adminAccModalClose').addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('visible'); });

    document.getElementById('adminAccTogglePwd').addEventListener('click', () => {
      const pwd = document.getElementById('adminAccPassword');
      pwd.type  = pwd.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('adminAccSaveBtn').addEventListener('click', async () => {
      const name   = document.getElementById('adminAccName').value.trim();
      const phone  = document.getElementById('adminAccPhone').value.trim();
      const newPwd = document.getElementById('adminAccPassword').value.trim();

      const res = await apiPost('/users.php?action=update', { name, phone, password: newPwd });
      if (!res.ok) { showNotification(res.error || 'Save failed.', 'error'); return; }

      CURRENT_USER = res.user;
      const nameEl = document.getElementById('headerUser');
      if (nameEl) nameEl.textContent = CURRENT_USER.name || CURRENT_USER.email;
      document.getElementById('adminAccDisplayName').textContent = CURRENT_USER.name || 'Admin';

      const badge = document.getElementById('adminAccSavedBadge');
      badge.classList.add('show');
      setTimeout(() => badge.classList.remove('show'), 2500);
    });
  }

  document.getElementById('adminAccDisplayName').textContent = CURRENT_USER?.name || 'Admin';
  document.getElementById('adminAccName').value              = CURRENT_USER?.name  || '';
  document.getElementById('adminAccEmail').value             = CURRENT_USER?.email || ADMIN_EMAIL;
  document.getElementById('adminAccPhone').value             = CURRENT_USER?.phone || '';
  document.getElementById('adminAccPassword').value          = '';
  document.getElementById('adminAccPassword').type           = 'password';

  overlay.classList.add('visible');
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════ */

function emptyState(msg) {
  return `<div class="admin-empty">${escHtml(msg)}</div>`;
}

function showNotification(message, type = 'info') {
  let stack = document.getElementById('siteNotifStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'siteNotifStack';
    stack.className = 'site-notif-stack';
    document.body.appendChild(stack);
  }
  const icons = { error: '!', success: '✓', warning: '!', info: 'i' };
  const n = document.createElement('div');
  n.className = `site-notif site-notif--${type}`;
  n.innerHTML = `
    <div class="site-notif-icon">${icons[type] || 'i'}</div>
    <div class="site-notif-body"><div class="site-notif-msg">${message}</div></div>
    <button class="site-notif-close" aria-label="Close">×</button>
  `;
  const dismiss = () => { n.classList.add('site-notif--hide'); setTimeout(() => n.remove(), 300); };
  n.querySelector('.site-notif-close').addEventListener('click', dismiss);
  stack.appendChild(n);
  setTimeout(dismiss, 5000);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════════════════
   FEEDBACKS
   ═══════════════════════════════════════════════════════════ */

async function renderFeedbacks() {
  const container = document.getElementById('feedbacksContainer');
  if (!container) return;

  const res = await apiGet('/feedbacks.php');
  if (!res.ok) { container.innerHTML = emptyState('Failed to load feedbacks.'); return; }

  const feedbacks = res.feedbacks || [];
  if (!feedbacks.length) { container.innerHTML = emptyState('No feedbacks yet.'); return; }

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel-header">Customer Feedbacks — toggle which ones appear on the Home and Contact pages</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Occasion</th><th>Rating</th>
            <th style="min-width:200px">Comment</th><th>Date</th><th>Featured</th><th>Delete</th>
          </tr>
        </thead>
        <tbody>
          ${feedbacks.map(fb => `
            <tr>
              <td><strong>${escHtml(fb.name)}</strong></td>
              <td class="text-muted">${escHtml(fb.occasion || '—')}</td>
              <td style="color:#f2b93b;letter-spacing:0.05em">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</td>
              <td style="font-size:0.82rem;max-width:260px">"${escHtml(fb.comment)}"</td>
              <td class="text-muted" style="white-space:nowrap;font-size:0.82rem">${escHtml(fb.date)}</td>
              <td>
                <button class="admin-btn-sm ${fb.is_featured ? 'admin-btn-primary' : 'admin-btn-secondary'} toggle-featured-btn"
                        data-id="${fb.id}">
                  ${fb.is_featured ? 'Featured' : 'Set Featured'}
                </button>
              </td>
              <td>
                <button class="admin-btn-sm admin-btn-danger delete-feedback-btn" data-id="${fb.id}">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.toggle-featured-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await apiPost('/feedbacks.php?action=toggle_featured', { id: parseInt(btn.dataset.id) });
      if (!r.ok) { showNotification(r.error || 'Failed.', 'error'); return; }
      renderFeedbacks();
    });
  });

  container.querySelectorAll('.delete-feedback-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this feedback permanently?')) return;
      const r = await apiPost('/feedbacks.php?action=delete', { id: parseInt(btn.dataset.id) });
      if (!r.ok) { showNotification(r.error || 'Failed.', 'error'); return; }
      renderFeedbacks();
    });
  });
}
