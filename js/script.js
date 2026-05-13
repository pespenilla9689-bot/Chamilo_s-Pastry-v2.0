// script.js  — API-backed version (PHP + MySQL)

/* =========================================================
   API HELPERS
   ========================================================= */

const API = '/api';

async function apiFetch(endpoint, options = {}) {
  const res = await fetch(API + endpoint, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

function apiGet(endpoint) {
  return apiFetch(endpoint);
}

function apiPost(endpoint, data) {
  return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
}

/* =========================================================
   SESSION CACHE  (populated once at DOMContentLoaded)
   ========================================================= */

let _user = null; // full user object or null

async function loadSession() {
  try {
    const res = await apiGet('/auth.php?action=me');
    _user = (res.ok && res.user) ? res.user : null;
  } catch {
    _user = null;
  }
}

function getCurrentUser()     { return _user?.email ?? null; }
function getCurrentUserData() { return _user; }

function updateCurrentUserCache(updated) { _user = updated; }

async function updateCurrentUser(updatedFields) {
  const res = await apiPost('/users.php?action=update', updatedFields);
  if (res.ok) { _user = res.user; }
  return res;
}

/* =========================================================
   PAGE LOADER
   ========================================================= */

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('pageLoader');
    if (!loader) return;

    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => { loader.classList.add('pop-in'); });
    });

    setTimeout(() => {
      loader.classList.add('show-content');
      setTimeout(() => loader.classList.add('fill-bar'), 100);
    }, 450);

    setTimeout(() => {
      loader.classList.remove('show-content');
      setTimeout(() => {
        loader.classList.remove('pop-in');
        loader.classList.add('pop-out');
        setTimeout(() => {
          loader.classList.add('page-loader--hide');
          document.body.style.overflow = '';
          setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 400);
        }, 400);
      }, 200);
    }, 2400);
  });
})();

/* =========================================================
   GLOBAL INITIALIZATION
   ========================================================= */

let cartToastTimer    = null;
let checkoutOverlayEl = null;

const ADMIN_EMAIL      = 'admin@chamilos.com';
const GOOGLE_CLIENT_ID = '268115312006-o1oh6k8a36585t2v4tkma2u21mbibcc6.apps.googleusercontent.com';
const FACEBOOK_APP_ID  = '1598730771586441';

async function handleGoogleAccessToken(response) {
  if (response.error) { showNotification('Google sign-in was cancelled.', 'info'); return; }
  const res = await apiPost('/auth.php?action=google', { accessToken: response.access_token });
  if (!res.ok) { showNotification(res.error || 'Google sign-in failed.', 'error'); return; }
  _user = res.user;
  const from = new URLSearchParams(window.location.search).get('from');
  window.location.href = from || '../html/index.html';
}

async function handleFacebookResponse(accessToken) {
  const res = await apiPost('/auth.php?action=facebook', { accessToken });
  if (!res.ok) { showNotification(res.error || 'Facebook sign-in failed.', 'error'); return; }
  _user = res.user;
  const from = new URLSearchParams(window.location.search).get('from');
  window.location.href = from || '../html/index.html';
}

window.fbAsyncInit = function () {
  if (FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID') return;
  FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: 'v19.0' });
};

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

  const dismiss = () => {
    n.classList.add('site-notif--hide');
    setTimeout(() => n.remove(), 300);
  };

  n.querySelector('.site-notif-close').addEventListener('click', dismiss);
  stack.appendChild(n);
  setTimeout(dismiss, 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSession();

  setupYear();
  setupNav();
  highlightActiveNav();
  updateNavAuth();

  initCartToast();
  initCartOverlay();
  setupCart();

  setupAuthForm();
  setupCarousel();
  setupContactForm();
  initHeaderScrollHide();

  initScrollReveal();
  applyMenuOverrides(); // fire-and-forget async — doesn't block rendering
  renderFeaturedReviews();
  if (document.body.dataset.page !== 'login') initDealButton();
});

/* =========================================================
   SCROLL-REVEAL
   ========================================================= */

function initScrollReveal() {
  const els = document.querySelectorAll('.scroll-reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = parseFloat(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('in-view'), delay * 1000);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach((el) => observer.observe(el));
}

/* =========================================================
   PRODUCT OVERRIDES (applied to public-facing pages)
   ========================================================= */

async function applyMenuOverrides() {
  let overrideMap;
  try {
    const res = await apiGet('/products.php');
    if (!res.ok) return;
    overrideMap = {};
    for (const p of res.products) overrideMap[p.id] = p;
  } catch { return; }

  document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
    const ov = overrideMap[btn.dataset.id];
    if (!ov) return;
    const card = btn.closest('.menu-card, .featured-card, .carousel-item');

    if (ov.name) {
      btn.dataset.name = ov.name;
      if (card) {
        const el = card.querySelector('.menu-card-name, .featured-name');
        if (el) el.textContent = ov.name;
      }
    }
    if (ov.price) {
      btn.dataset.price = String(ov.price);
      if (card) {
        const el = card.querySelector('.menu-card-price, .featured-price');
        if (el) el.textContent = `From ₱${Number(ov.price).toLocaleString()}`;
      }
    }
    if (ov.image_data) {
      btn.dataset.image = ov.image_data;
      if (card) {
        const img = card.querySelector('img');
        if (img) img.src = ov.image_data;
      }
    }
  });
}

/* =========================================================
   FOOTER YEAR
   ========================================================= */

function setupYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* =========================================================
   NAVIGATION (MOBILE)
   ========================================================= */

function setupNav() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  if (toggle && header) {
    toggle.addEventListener('click', () => header.classList.toggle('nav-open'));
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target)) header.classList.remove('nav-open');
    });
  }
}

function highlightActiveNav() {
  const page  = document.body.getAttribute('data-page');
  const links = document.querySelectorAll('.nav-links a');
  links.forEach((link) => {
    if (page && link.getAttribute('href')?.includes(page)) link.classList.add('active');
  });
}

/* =========================================================
   NAV AUTH DROPDOWN
   ========================================================= */

function buildNavAvatarHtml(user) {
  const src = user?.avatar || user?.picture_url;
  if (src) return `<img src="${src}" class="nav-avatar-img" alt="Profile" />`;
  const initials = ((user?.name || user?.email || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase());
  return `<span class="nav-avatar-initials">${initials}</span>`;
}

function updateNavAvatarDisplay() {
  const link = document.querySelector('.nav-actions a.nav-user-active');
  if (!link) return;
  const u = getCurrentUserData();
  link.innerHTML = buildNavAvatarHtml(u);
}

function updateNavAuth() {
  const user      = getCurrentUserData();
  const loginLink = document.querySelector('.nav-actions a.btn-ghost');
  if (!loginLink) return;

  if (user) {
    loginLink.innerHTML = buildNavAvatarHtml(user);
    loginLink.href = '#';
    loginLink.classList.add('nav-user-active', 'nav-user-avatar-btn');

    const actionsEl = loginLink.closest('.nav-actions');
    if (actionsEl) actionsEl.style.position = 'relative';

    const isAdmin = user.role === 'admin' || user.email === ADMIN_EMAIL;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-user-dropdown';
    dropdown.id = 'navUserDropdown';
    dropdown.innerHTML = `
      <button class="dropdown-account"  id="dropdownAccountBtn">Account Details</button>
      <button class="dropdown-myorders" id="dropdownMyOrdersBtn">My Orders</button>
      ${isAdmin ? `<a href="/html/admin.html" class="dropdown-admin-link">Admin Dashboard</a>` : ''}
      <button class="dropdown-logout"   id="dropdownLogoutBtn">Log out</button>
    `;
    (actionsEl || loginLink.parentElement).appendChild(dropdown);

    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== loginLink) {
        dropdown.classList.remove('visible');
      }
    });

    document.getElementById('dropdownAccountBtn').addEventListener('click', () => {
      dropdown.classList.remove('visible');
      showAccountDetailsModal();
    });

    document.getElementById('dropdownMyOrdersBtn').addEventListener('click', () => {
      dropdown.classList.remove('visible');
      showMyOrdersModal();
    });

    document.getElementById('dropdownLogoutBtn').addEventListener('click', async () => {
      await apiPost('/auth.php?action=logout', {});
      localStorage.removeItem('sweetLayersCart');
      _user = null;
      window.location.reload();
    });
  }
}

/* =========================================================
   CART SYSTEM  (kept in localStorage — session UI state)
   ========================================================= */

function getCart() {
  try { return JSON.parse(localStorage.getItem('sweetLayersCart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('sweetLayersCart', JSON.stringify(cart));
}

function updateCartCount() {
  const count = getCart().reduce((t, i) => t + (i.qty || 1), 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count;
}

function addToCart(product) {
  if (!getCurrentUser()) { showAuthGate(); return false; }

  const cart     = getCart();
  const existing = cart.find((i) => i.id === product.id);
  if (existing) { existing.qty = (existing.qty || 1) + 1; }
  else          { cart.push({ ...product, qty: 1 }); }

  saveCart(cart);
  updateCartCount();
  showCartToast(product);
  return true;
}

function setupCart() {
  updateCartCount();

  document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const added = addToCart({
        id:    btn.dataset.id,
        name:  btn.dataset.name,
        price: Number(btn.dataset.price),
        image: btn.dataset.image || '',
      });
      if (added) {
        btn.style.transform = 'translateY(-2px) scale(1.05)';
        btn.style.boxShadow = '0 16px 35px rgba(75, 59, 71, 0.18)';
        setTimeout(() => { btn.style.transform = ''; btn.style.boxShadow = ''; }, 180);
      }
    });
  });

  const navCart = document.querySelector('.nav-cart');
  if (navCart) navCart.addEventListener('click', toggleCartOverlay);
}

/* =========================================================
   NAVBAR HIDE ON SCROLL
   ========================================================= */

let lastScrollY  = window.scrollY;
let header       = null;
const revealZone = 60;

function initHeaderScrollHide() {
  header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll',    handleHeaderScroll);
  window.addEventListener('mousemove', handleHeaderHoverReveal);
}

function handleHeaderScroll() {
  if (!header) return;
  if (window.scrollY > lastScrollY && window.scrollY > 120) {
    header.classList.add('header-hidden');
    closeCartOverlay();
  } else {
    header.classList.remove('header-hidden');
  }
  lastScrollY = window.scrollY;
}

function handleHeaderHoverReveal(e) {
  if (!header) return;
  if (e.clientY < revealZone) header.classList.remove('header-hidden');
}

/* =========================================================
   CART OVERLAY
   ========================================================= */

function initCartOverlay() {
  if (document.getElementById('cartOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id        = 'cartOverlay';
  overlay.className = 'cart-overlay';
  overlay.innerHTML = `
    <div class="cart-panel">
      <div class="cart-panel-header">
        <div class="cart-panel-title">Your Cart</div>
        <button class="cart-panel-close" id="closeCartOverlay">×</button>
      </div>
      <div id="cartOverlayContent"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('closeCartOverlay').addEventListener('click', closeCartOverlay);
  overlay.addEventListener('click', (e) => { if (e.target.id === 'cartOverlay') closeCartOverlay(); });
}

function toggleCartOverlay() {
  const overlay = document.getElementById('cartOverlay');
  if (!overlay) return;
  overlay.classList.contains('visible') ? closeCartOverlay() : openCartOverlay();
}

function openCartOverlay() {
  const overlay = document.getElementById('cartOverlay');
  if (!overlay) return;
  renderCartOverlay();
  positionCartPanel();
  overlay.classList.add('visible');
}

function closeCartOverlay() {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function positionCartPanel() {
  const panel   = document.querySelector('.cart-panel');
  const cartBtn = document.querySelector('.nav-cart');
  if (!panel || !cartBtn) return;
  const rect = cartBtn.getBoundingClientRect();
  panel.style.top   = rect.bottom + 12 + 'px';
  panel.style.right = window.innerWidth - rect.right + 'px';
}

window.addEventListener('resize', () => {
  if (document.getElementById('cartOverlay')?.classList.contains('visible')) positionCartPanel();
});

/* =========================================================
   RENDER CART CONTENT
   ========================================================= */

function renderCartOverlay() {
  const container = document.getElementById('cartOverlayContent');
  if (!container) return;

  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = `<div class="cart-empty-message">Your cart is empty</div>`;
    return;
  }

  let total = 0;
  container.innerHTML =
    cart.map((item) => {
      const qty   = item.qty || 1;
      const price = item.price || 0;
      total      += qty * price;
      const imgHtml = item.image
        ? `<img src="${item.image}" alt="${item.name}" class="cart-item-img" />`
        : `<div class="cart-item-img-placeholder"></div>`;
      return `
        <div class="cart-item-row" data-id="${item.id}">
          ${imgHtml}
          <div class="cart-item-details">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">₱${price.toLocaleString()}</div>
          </div>
          <div class="qty-controls">
            <button data-cart-action="dec" data-id="${item.id}">−</button>
            <span>${qty}</span>
            <button data-cart-action="inc" data-id="${item.id}">+</button>
          </div>
          <button class="cart-remove-btn" data-cart-action="remove" data-id="${item.id}">✕</button>
        </div>`;
    }).join('') +
    `<div class="cart-summary-box">
      <div class="cart-summary-row cart-summary-total">
        <span>Total</span><span>₱${total.toLocaleString()}</span>
      </div>
      <button class="btn btn-primary" id="checkoutBtn" style="margin-top:.7rem;width:100%">
        Checkout
      </button>
    </div>`;

  container.querySelectorAll('[data-cart-action]').forEach((btn) =>
    btn.addEventListener('click', () => handleCartAction(btn.dataset.cartAction, btn.dataset.id))
  );

  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (!getCurrentUser()) { closeCartOverlay(); showAuthGate(); return; }
    showCheckoutModal(cart, total);
  });
}

/* =========================================================
   UPDATE CART ITEMS
   ========================================================= */

function handleCartAction(action, id) {
  let cart  = getCart();
  const idx = cart.findIndex((i) => i.id === id);
  if (idx === -1) return;

  if      (action === 'inc')    cart[idx].qty++;
  else if (action === 'dec')    { cart[idx].qty--; if (cart[idx].qty < 1) cart.splice(idx, 1); }
  else if (action === 'remove') cart.splice(idx, 1);

  saveCart(cart);
  updateCartCount();
  renderCartOverlay();
}

/* =========================================================
   CART TOAST
   ========================================================= */

function initCartToast() {
  if (document.getElementById('cartToast')) return;

  const toast     = document.createElement('div');
  toast.id        = 'cartToast';
  toast.className = 'cart-toast';
  toast.innerHTML = `
    <div class="cart-toast-main">
      <div class="cart-toast-title">Added to cart</div>
      <div class="cart-toast-text" id="cartToastText">Item added to your cart.</div>
      <div class="cart-toast-actions">
        <button class="cart-toast-btn cart-toast-btn-primary" id="cartToastViewCart">View cart</button>
        <button class="cart-toast-btn cart-toast-btn-ghost"   id="cartToastContinue">Continue</button>
      </div>
    </div>
    <button class="cart-toast-close" id="cartToastClose">×</button>
  `;
  document.body.appendChild(toast);

  document.getElementById('cartToastViewCart').addEventListener('click', () => { hideCartToast(); openCartOverlay(); });
  document.getElementById('cartToastContinue').addEventListener('click', hideCartToast);
  document.getElementById('cartToastClose').addEventListener('click',    hideCartToast);
}

function showCartToast(product) {
  const toast = document.getElementById('cartToast');
  if (!toast) return;
  document.getElementById('cartToastText').textContent = `"${product.name}" has been added to your cart.`;
  toast.classList.add('cart-toast--visible');
  if (cartToastTimer) clearTimeout(cartToastTimer);
  cartToastTimer = setTimeout(hideCartToast, 3500);
}

function hideCartToast() {
  const toast = document.getElementById('cartToast');
  if (toast) toast.classList.remove('cart-toast--visible');
}

/* =========================================================
   CHECKOUT MODAL
   ========================================================= */

function showCheckoutModal(cart, total) {
  if (!cart.length) return;

  if (!checkoutOverlayEl) {
    checkoutOverlayEl           = document.createElement('div');
    checkoutOverlayEl.className = 'checkout-overlay';
    document.body.appendChild(checkoutOverlayEl);
  }

  const user = getCurrentUserData();
  let finalTotal  = total;
  let voucherCode = null;

  const itemsHtml = cart.map((item) => {
    const imgHtml = item.image
      ? `<img src="${item.image}" alt="${item.name}" class="checkout-item-img" />`
      : `<div class="checkout-item-img-placeholder"></div>`;
    return `
      <div class="checkout-item-row">
        ${imgHtml}
        <div class="checkout-item-info">
          <div class="checkout-item-name">${item.name}</div>
          <div class="checkout-item-qty">× ${item.qty || 1}</div>
        </div>
        <div class="checkout-item-price">₱${((item.price||0)*(item.qty||1)).toLocaleString()}</div>
      </div>`;
  }).join('');

  checkoutOverlayEl.innerHTML = `
    <div class="checkout-panel">
      <div class="checkout-header">
        <div class="checkout-title">Complete Your Order</div>
        <button class="checkout-close" id="checkoutCloseBtn">×</button>
      </div>
      <div class="checkout-body">

        <div class="checkout-section-label">Order Summary</div>
        <div class="checkout-summary">
          ${itemsHtml}
          <div class="checkout-summary-row checkout-summary-total" style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid #f0e8ff">
            <span>Total</span><span id="checkoutTotalDisplay">₱${total.toLocaleString()}</span>
          </div>
          <div id="checkoutDiscountRow" style="display:none;text-align:right;color:#3a9e6a;font-size:0.82rem;margin-top:0.2rem">
            <span id="checkoutDiscountText"></span>
          </div>
        </div>

        <div class="checkout-section-label">Your Details</div>
        <input type="text"  id="orderName"  class="checkout-input" placeholder="Full name *"      value="${user?.name  || ''}" />
        <input type="tel"   id="orderPhone" class="checkout-input" placeholder="Phone number *" />
        <input type="email" id="orderEmail" class="checkout-input" placeholder="Email address"    value="${user?.email || ''}" />

        <div class="checkout-section-label">Delivery</div>
        <div class="checkout-delivery-row">
          <label class="checkout-radio-label">
            <input type="radio" name="deliveryMethod" value="pickup" checked /> Pickup
          </label>
          <label class="checkout-radio-label">
            <input type="radio" name="deliveryMethod" value="delivery" /> Delivery
          </label>
        </div>
        <div id="deliveryAddressRow" style="display:none">
          ${(user?.savedAddresses?.length) ? `
            <div class="checkout-section-label" style="margin-top:0.4rem">Select saved address</div>
            <div style="display:flex;flex-wrap:wrap;gap:0.45rem;margin-bottom:0.6rem" id="savedAddrPicker">
              ${user.savedAddresses.map((addr, i) => `
                <label class="checkout-radio-label" style="font-size:0.82rem;background:rgba(230,215,255,0.3);padding:0.35rem 0.8rem;border-radius:999px;cursor:pointer">
                  <input type="radio" name="savedAddr" value="${addr}" ${i === 0 ? 'checked' : ''} /> ${addr}
                </label>
              `).join('')}
              <label class="checkout-radio-label" style="font-size:0.82rem;padding:0.35rem 0.8rem;cursor:pointer">
                <input type="radio" name="savedAddr" value="__new__" /> New address
              </label>
            </div>
          ` : ''}
          <div id="orderAddressInputWrap">
            <input type="text" id="orderAddress" class="checkout-input"
                   placeholder="Full delivery address *"
                   value="${user?.savedAddresses?.length ? user.savedAddresses[0] : ''}" />
            <div class="checkout-input-hint">
              <label style="cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem">
                <input type="checkbox" id="saveAddressCheck" style="margin:0" />
                Save this address to my account
              </label>
            </div>
          </div>
        </div>
        <input type="date" id="orderDate" class="checkout-input" style="margin-top:.3rem" />
        <div class="checkout-input-hint">Preferred pickup / delivery date</div>

        <div class="checkout-section-label">Cake Details</div>
        <input type="text" id="orderCakeMessage" class="checkout-input"
               placeholder="Message on cake (e.g. Happy Birthday, Ana!)" />
        <textarea id="orderInstructions" class="checkout-textarea"
                  placeholder="Special instructions (optional)"></textarea>

        <div class="checkout-section-label">Payment Method</div>
        <div class="checkout-datetime-row">Order placed: <strong>${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</strong></div>
        <div class="checkout-methods">
          <div class="checkout-method">
            <input type="radio" name="payment" value="gcash" id="payGcash" checked />
            <label for="payGcash">GCASH / E-wallet</label>
          </div>
          <div class="checkout-method">
            <input type="radio" name="payment" value="bank" id="payBank" />
            <label for="payBank">Bank transfer</label>
          </div>
          <div class="checkout-method">
            <input type="radio" name="payment" value="cash" id="payCash" />
            <label for="payCash">Cash on pickup</label>
          </div>
          <div class="checkout-method">
            <input type="radio" name="payment" value="cod" id="payCod" />
            <label for="payCod">Cash on delivery</label>
          </div>
        </div>

        <div class="checkout-section-label">Voucher / Promo Code</div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.2rem">
          <input type="text" id="checkoutVoucherInput" class="checkout-input"
                 placeholder="Enter voucher code (optional)"
                 style="flex:1;margin:0;text-transform:uppercase" />
          <button class="btn btn-ghost" id="applyVoucherBtn"
                  style="white-space:nowrap;flex-shrink:0;padding:0.55rem 1rem">Apply</button>
        </div>
        <div id="checkoutVoucherStatus" style="font-size:0.82rem;min-height:1rem;margin-bottom:0.4rem"></div>

        <div class="checkout-footer">
          <button class="btn btn-ghost"    id="backToCartBtn">Back to cart</button>
          <button class="btn btn-primary"  id="confirmOrderBtn">Place Order</button>
        </div>

      </div>
    </div>
  `;

  const orderPhoneEl = document.getElementById('orderPhone');
  if (orderPhoneEl) {
    orderPhoneEl.setAttribute('maxlength', '11');
    orderPhoneEl.setAttribute('inputmode', 'numeric');
    orderPhoneEl.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
    });
  }

  checkoutOverlayEl.querySelectorAll('input[name="deliveryMethod"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const row = document.getElementById('deliveryAddressRow');
      if (row) row.style.display = radio.value === 'delivery' ? 'block' : 'none';
    });
  });

  checkoutOverlayEl.querySelectorAll('input[name="savedAddr"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const addrInput = document.getElementById('orderAddress');
      if (addrInput) addrInput.value = radio.value === '__new__' ? '' : radio.value;
    });
  });

  document.getElementById('applyVoucherBtn')?.addEventListener('click', async () => {
    const code     = (document.getElementById('checkoutVoucherInput')?.value || '').trim().toUpperCase();
    const statusEl = document.getElementById('checkoutVoucherStatus');
    if (!code) { if (statusEl) statusEl.textContent = ''; return; }

    const res = await apiPost('/vouchers.php?action=apply', { code, total });
    if (!res.ok) {
      if (statusEl) { statusEl.textContent = res.error || 'Invalid code.'; statusEl.style.color = '#842029'; }
      voucherCode = null; finalTotal = total;
      const disp = document.getElementById('checkoutTotalDisplay');
      if (disp) disp.textContent = '₱' + total.toLocaleString();
      const discRow = document.getElementById('checkoutDiscountRow');
      if (discRow) discRow.style.display = 'none';
      return;
    }

    voucherCode = code;
    finalTotal  = Math.max(0, total - res.discount);
    if (statusEl) {
      statusEl.textContent = `Voucher applied — you save ₱${res.discount.toFixed(2)}`;
      statusEl.style.color = '#3a9e6a';
    }
    const disp     = document.getElementById('checkoutTotalDisplay');
    const discText = document.getElementById('checkoutDiscountText');
    const discRow  = document.getElementById('checkoutDiscountRow');
    if (disp)     disp.textContent = '₱' + finalTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (discText) discText.textContent = `-₱${res.discount.toFixed(2)} (${res.discountPct}% off)`;
    if (discRow)  discRow.style.display = 'block';
  });

  document.getElementById('checkoutCloseBtn').addEventListener('click', hideCheckoutModal);
  document.getElementById('backToCartBtn').addEventListener('click',    hideCheckoutModal);

  document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
    const name  = document.getElementById('orderName')?.value.trim();
    const phone = document.getElementById('orderPhone')?.value.trim();
    if (!name || !phone) { showNotification('Please enter your full name and phone number.', 'warning'); return; }

    const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value || 'pickup';
    const address        = document.getElementById('orderAddress')?.value.trim() || '';
    if (deliveryMethod === 'delivery' && !address) { showNotification('Please enter your delivery address.', 'warning'); return; }

    const btn = document.getElementById('confirmOrderBtn');
    btn.disabled    = true;
    btn.textContent = 'Placing order…';

    const saveAddress = deliveryMethod === 'delivery' &&
      document.getElementById('saveAddressCheck')?.checked && address;

    const res = await apiPost('/orders.php?action=create', {
      customerName:        name,
      customerPhone:       phone,
      customerEmail:       document.getElementById('orderEmail')?.value.trim() || '',
      deliveryMethod,
      address,
      preferredDate:       document.getElementById('orderDate')?.value || '',
      cakeMessage:         document.getElementById('orderCakeMessage')?.value.trim() || '',
      specialInstructions: document.getElementById('orderInstructions')?.value.trim() || '',
      paymentMethod:       document.querySelector('input[name="payment"]:checked')?.value || 'gcash',
      items:               cart,
      total:               finalTotal,
      saveAddress,
    });

    btn.disabled    = false;
    btn.textContent = 'Place Order';

    if (!res.ok) { showNotification(res.error || 'Order failed. Please try again.', 'error'); return; }

    if (voucherCode) await apiPost('/vouchers.php?action=redeem', { code: voucherCode });

    // Refresh cached user (saved address may have been added)
    const me = await apiGet('/auth.php?action=me');
    if (me.ok) _user = me.user;

    saveCart([]);
    updateCartCount();
    hideCheckoutModal();
    closeCartOverlay();
    showOrderConfirmation(res.orderId);
  });

  checkoutOverlayEl.addEventListener('click', (e) => {
    if (e.target === checkoutOverlayEl) hideCheckoutModal();
  });

  checkoutOverlayEl.classList.add('visible');
}

function hideCheckoutModal() {
  if (checkoutOverlayEl) checkoutOverlayEl.classList.remove('visible');
}

/* =========================================================
   ORDER CONFIRMATION
   ========================================================= */

function showOrderConfirmation(orderId) {
  const overlay     = document.createElement('div');
  overlay.className = 'order-confirm-overlay visible';
  overlay.innerHTML = `
    <div class="order-confirm-card">
      <h3 class="order-confirm-title">Order Placed!</h3>
      <p class="order-confirm-text">
        Your order <strong>${orderId}</strong> has been received.<br>
        We'll reach out shortly to confirm details.
      </p>
      <button class="btn btn-primary" id="confirmDoneBtn" style="width:100%;margin-top:1.2rem">Done</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('confirmDoneBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/* =========================================================
   AUTH GATE
   ========================================================= */

function initAuthGate() {
  if (document.getElementById('authGate')) return;
  const gate     = document.createElement('div');
  gate.id        = 'authGate';
  gate.className = 'auth-gate-overlay';
  gate.innerHTML = `
    <div class="auth-gate-card">
      <h3 class="auth-gate-title">Sign in to continue</h3>
      <p class="auth-gate-text">Please log in or create an account to add items to your cart and place orders.</p>
      <div class="auth-gate-actions">
        <a href="/html/login.html" class="btn btn-primary"  id="authGateLoginBtn">Log in</a>
        <a href="/html/login.html" class="btn btn-outline"  id="authGateSignupBtn">Create account</a>
      </div>
      <button class="auth-gate-dismiss" id="authGateDismiss">Maybe later</button>
    </div>
  `;
  document.body.appendChild(gate);
  document.getElementById('authGateDismiss').addEventListener('click', closeAuthGate);
  gate.addEventListener('click', (e) => { if (e.target.id === 'authGate') closeAuthGate(); });
}

function showAuthGate() {
  initAuthGate();
  const fromPath  = encodeURIComponent(window.location.pathname);
  const base      = '/html/login.html';
  const loginBtn  = document.getElementById('authGateLoginBtn');
  const signupBtn = document.getElementById('authGateSignupBtn');
  if (loginBtn)  loginBtn.href  = `${base}?from=${fromPath}`;
  if (signupBtn) signupBtn.href = `${base}?from=${fromPath}`;
  document.getElementById('authGate').classList.add('visible');
}

function closeAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.classList.remove('visible');
}

/* =========================================================
   LOGIN / REGISTER FORM
   ========================================================= */

function setupAuthForm() {
  const form      = document.getElementById('authForm');
  const card      = document.getElementById('loginSplitCard');
  const switchBtn = document.getElementById('switchPanelBtn');
  if (!form || !card || !switchBtn) return;

  const modeInput    = document.getElementById('authMode');
  const nameInput    = document.getElementById('authName');
  const termsRow     = document.getElementById('termsRow');
  const emailInput   = document.getElementById('authEmail');
  const passInput    = document.getElementById('authPassword');
  const submitBtn    = document.getElementById('authSubmitBtn');
  const colorHeading = document.getElementById('colorPanelHeading');
  const colorText    = document.getElementById('colorPanelText');
  const formHeading  = document.getElementById('formHeading');
  const formSub      = document.getElementById('formSubHeading');
  const formPanel    = card.querySelector('.login-panel-form');

  const curtain     = document.createElement('div');
  curtain.className = 'login-curtain';
  card.appendChild(curtain);

  let mode        = 'login';
  let isAnimating = false;
  const SWEEP_MS  = 380;

  const CONTENT = {
    login: {
      colorHeading : 'Hello, Friend!',
      colorText    : "Don't have an account?<br>Sign up and start your sweet journey.",
      switchLabel  : 'SIGN UP',
      formHeading  : 'Sign In',
      formSub      : 'Welcome back! Please login.',
      submitLabel  : 'SIGN IN',
    },
    register: {
      colorHeading : 'Welcome Back!',
      colorText    : 'Already have an account?<br>Sign in and continue your journey.',
      switchLabel  : 'SIGN IN',
      formHeading  : 'Create Account',
      formSub      : 'Sign up to start ordering delicious cakes!',
      submitLabel  : 'SIGN UP',
    },
  };

  function applyContent(m) {
    const c = CONTENT[m];
    colorHeading.textContent = c.colorHeading;
    colorText.innerHTML      = c.colorText;
    switchBtn.textContent    = c.switchLabel;
    formHeading.textContent  = c.formHeading;
    formSub.textContent      = c.formSub;
    submitBtn.textContent    = c.submitLabel;
    modeInput.value          = m;
    if (m === 'register') {
      nameInput.classList.remove('hidden');
      termsRow?.classList.remove('hidden');
    } else {
      nameInput.classList.add('hidden');
      termsRow?.classList.add('hidden');
    }
  }

  switchBtn.addEventListener('click', () => {
    if (isAnimating) return;
    isAnimating = true;
    curtain.classList.remove('sweep-out');
    curtain.classList.add('sweep-in');
    setTimeout(() => {
      mode = mode === 'login' ? 'register' : 'login';
      card.classList.toggle('show-register');
      applyContent(mode);
      curtain.classList.remove('sweep-in');
      curtain.classList.add('sweep-out');
      formPanel.classList.add('form-slide-in');
      setTimeout(() => {
        curtain.classList.remove('sweep-out');
        formPanel.classList.remove('form-slide-in');
        isAnimating = false;
      }, SWEEP_MS);
    }, SWEEP_MS);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = emailInput.value.trim().toLowerCase();
    const password = passInput.value.trim();
    const name     = nameInput.value.trim();
    if (!email || !password) { showNotification('Please enter your email and password.', 'warning'); return; }

    const fromParam  = new URLSearchParams(window.location.search).get('from');
    const redirectTo = fromParam || '../html/index.html';

    submitBtn.disabled    = true;
    submitBtn.textContent = '…';

    if (mode === 'register') {
      if (!name) { showNotification('Please enter your full name.', 'warning'); submitBtn.disabled = false; applyContent(mode); return; }
      const termsCheck = document.getElementById('termsCheck');
      if (termsCheck && !termsCheck.checked) {
        showNotification('You must agree to the Terms & Conditions.', 'warning');
        submitBtn.disabled = false; applyContent(mode); return;
      }

      const res = await apiPost('/auth.php?action=register', { email, password, name });
      submitBtn.disabled = false; applyContent(mode);
      if (!res.ok) { showNotification(res.error || 'Registration failed.', 'error'); return; }
      _user = res.user;
      showNotification('Account created! Welcome to Chamilo\'s Pastry.', 'success');
      window.location.href = redirectTo;

    } else {
      const res = await apiPost('/auth.php?action=login', { email, password });
      submitBtn.disabled = false; applyContent(mode);
      if (!res.ok) { showNotification(res.error || 'Incorrect email or password.', 'error'); return; }
      _user = res.user;
      if (res.user.role === 'admin' || res.user.role === 'manager' || res.user.role === 'staff') {
        // Staff-level users go to admin
        if (res.user.role === 'admin') { window.location.href = '../html/admin.html'; return; }
      }
      window.location.href = redirectTo;
    }
  });

  applyContent(mode);

  const forgotLink = document.querySelector('.login-forgot');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showForgotPasswordModal();
    });
  }

  const googleBtn = form.querySelector('.social-btn.google');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      if (!window.google || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
        showNotification('Google Sign-In is not configured yet. Set your GOOGLE_CLIENT_ID in script.js.', 'info');
        return;
      }
      google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'email profile openid',
        callback: handleGoogleAccessToken,
      }).requestAccessToken({ prompt: 'select_account' });
    });
  }

  const facebookBtn = form.querySelector('.social-btn.facebook');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', () => {
      if (FACEBOOK_APP_ID === 'YOUR_FACEBOOK_APP_ID' || !window.FB) {
        showNotification('Facebook Login is not configured yet. Set your FACEBOOK_APP_ID in script.js.', 'info');
        return;
      }
      FB.login((response) => {
        if (response.authResponse) handleFacebookResponse(response.authResponse.accessToken);
      }, { scope: 'email,public_profile' });
    });
  }
}

/* =========================================================
   ACCOUNT DETAILS MODAL
   ========================================================= */

function renderPaymentTags(methods) {
  const container = document.getElementById('accountPaymentTags');
  if (!container) return;
  if (!methods.length) {
    container.innerHTML = '<span class="account-empty-hint">No payment methods saved yet.</span>';
    return;
  }
  container.innerHTML = methods.map((m) =>
    `<span class="account-tag">${m}
       <button class="account-tag-remove" data-remove-payment="${m}" type="button">✕</button>
     </span>`
  ).join('');
  container.querySelectorAll('[data-remove-payment]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const res = await apiPost('/users.php?action=remove_payment', { method: btn.dataset.removePayment });
      if (res.ok) { _user = await apiGet('/auth.php?action=me').then(r => r.user); renderPaymentTags(_user?.paymentMethods || []); }
    });
  });
}

function renderAddressTags(addresses) {
  const container = document.getElementById('accountAddressTags');
  if (!container) return;
  if (!addresses.length) {
    container.innerHTML = '<span class="account-empty-hint">No saved addresses yet.</span>';
    return;
  }
  container.innerHTML = addresses.map((a) =>
    `<span class="account-tag">${a}
       <button class="account-tag-remove" data-remove-address="${encodeURIComponent(a)}" type="button">✕</button>
     </span>`
  ).join('');
  container.querySelectorAll('[data-remove-address]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const decoded = decodeURIComponent(btn.dataset.removeAddress);
      const res = await apiPost('/users.php?action=remove_address', { address: decoded });
      if (res.ok) { _user = await apiGet('/auth.php?action=me').then(r => r.user); renderAddressTags(_user?.savedAddresses || []); }
    });
  });
}

function renderAccountAvatar() {
  const display = document.getElementById('accountAvatarDisplay');
  if (!display) return;
  const u = getCurrentUserData();
  const src = u?.avatar || u?.picture_url;
  if (src) {
    display.innerHTML = `<img src="${src}" class="account-avatar-img" alt="Profile" />`;
  } else {
    const initials = ((u?.name || u?.email || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase());
    display.innerHTML = `<div class="account-avatar-initials-large">${initials}</div>`;
  }
}

function showAccountDetailsModal() {
  let overlay = document.getElementById('accountModal');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'account-modal-overlay';
    overlay.id = 'accountModal';
    overlay.innerHTML = `
      <div class="account-modal-card">
        <div class="account-modal-header">
          <h2 class="account-modal-title">My Account</h2>
          <button class="account-modal-close" id="accountModalClose" type="button">✕</button>
        </div>
        <div class="account-modal-body">
          <div class="account-avatar-section">
            <div class="account-avatar-display" id="accountAvatarDisplay"></div>
            <button class="account-avatar-change-btn" id="accountChangeAvatarBtn" type="button">Change Photo</button>
            <input type="file" id="accountAvatarInput" accept="image/*"
                   style="position:absolute;left:-9999px;opacity:0;width:0.1px;height:0.1px;overflow:hidden" />
            <div class="account-avatar-name" id="accountDisplayName"></div>
            <div class="account-role-badge customer" id="accountRoleBadge">Customer</div>
          </div>

          <div class="account-section-title">Personal Information</div>
          <div class="account-field">
            <label>Full Name</label>
            <div class="account-field-row">
              <input type="text" id="accountName" placeholder="Your full name" />
            </div>
          </div>
          <div class="account-field">
            <label>Email Address</label>
            <div class="account-field-row">
              <input type="email" id="accountEmail" readonly />
            </div>
          </div>
          <div class="account-field">
            <label>Phone Number</label>
            <div class="account-field-row">
              <input type="tel" id="accountPhone" placeholder="e.g. 09XXXXXXXXX" maxlength="11" inputmode="numeric" pattern="[0-9]*" />
            </div>
          </div>

          <div class="account-section-title">Password</div>
          <button class="account-change-pwd-btn" id="openChangePwdBtn" type="button">🔐 Change Password</button>

          <div class="account-section-title">Preferred Payment Methods</div>
          <div class="account-tags-wrap" id="accountPaymentTags"></div>
          <div class="account-add-row">
            <select id="addPaymentSelect">
              <option value="">Select payment method</option>
              <option value="GCASH / E-wallet">GCASH / E-wallet</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
              <option value="Cash on Pickup">Cash on Pickup</option>
              <option value="Credit / Debit Card">Credit / Debit Card</option>
            </select>
            <button class="account-add-btn" id="addPaymentBtn" type="button">+ Add</button>
          </div>

          <div class="account-section-title">Saved Addresses</div>
          <div class="account-tags-wrap" id="accountAddressTags"></div>
          <div class="account-add-row">
            <input type="text" id="addAddressInput" placeholder="Enter delivery address..." />
            <button class="account-add-btn" id="addAddressBtn" type="button">+ Add</button>
          </div>

          <button class="account-save-btn" id="accountSaveBtn" type="button">Save Changes</button>
          <div class="account-saved-badge" id="accountSavedBadge">✓ Changes saved successfully</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('accountModalClose').addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });

    document.getElementById('openChangePwdBtn').addEventListener('click', () => {
      overlay.classList.remove('visible');
      showChangePasswordModal();
    });

    document.getElementById('accountPhone').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
    });

    document.getElementById('accountChangeAvatarBtn').addEventListener('click', () => {
      document.getElementById('accountAvatarInput').click();
    });

    document.getElementById('accountAvatarInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { showNotification('Image must be under 3 MB.', 'warning'); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target.result;
        const res = await apiPost('/users.php?action=update', { avatar: base64 });
        if (!res.ok) { showNotification(res.error || 'Upload failed.', 'error'); return; }
        _user = res.user;
        renderAccountAvatar();
        updateNavAvatarDisplay();
        showNotification('Profile picture updated.', 'success');
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('addPaymentBtn').addEventListener('click', async () => {
      const sel = document.getElementById('addPaymentSelect');
      const val = sel.value;
      if (!val) return;
      const res = await apiPost('/users.php?action=add_payment', { method: val });
      if (res.ok) { _user = await apiGet('/auth.php?action=me').then(r => r.user); renderPaymentTags(_user?.paymentMethods || []); }
      sel.value = '';
    });

    document.getElementById('addAddressBtn').addEventListener('click', async () => {
      const input = document.getElementById('addAddressInput');
      const val   = input.value.trim();
      if (!val) return;
      const res = await apiPost('/users.php?action=add_address', { address: val });
      if (res.ok) { _user = await apiGet('/auth.php?action=me').then(r => r.user); renderAddressTags(_user?.savedAddresses || []); }
      input.value = '';
    });

    document.getElementById('accountSaveBtn').addEventListener('click', async () => {
      const newName = document.getElementById('accountName').value.trim();
      const phone   = document.getElementById('accountPhone').value.trim();

      const res = await apiPost('/users.php?action=update', { name: newName, phone });
      if (!res.ok) { showNotification(res.error || 'Save failed.', 'error'); return; }
      _user = res.user;

      document.getElementById('accountDisplayName').textContent = _user.name || 'Account';
      updateNavAvatarDisplay();

      const badge = document.getElementById('accountSavedBadge');
      badge.classList.add('show');
      setTimeout(() => badge.classList.remove('show'), 2500);
    });
  }

  const u = getCurrentUserData();
  if (!u) return;

  renderAccountAvatar();

  const isAdmin = u.role === 'admin' || u.email === ADMIN_EMAIL;
  document.getElementById('accountDisplayName').textContent  = u.name  || 'Account';
  document.getElementById('accountName').value               = u.name  || '';
  document.getElementById('accountEmail').value              = u.email || '';
  document.getElementById('accountPhone').value              = u.phone || '';
  const roleBadge = document.getElementById('accountRoleBadge');
  if (roleBadge) {
    if (isAdmin) {
      roleBadge.className   = 'account-role-badge admin';
      roleBadge.textContent = 'Admin — Highest Authority';
    } else if (u.role === 'staff' || u.role === 'manager') {
      roleBadge.className   = 'account-role-badge staff';
      roleBadge.textContent = u.role.charAt(0).toUpperCase() + u.role.slice(1) + (u.title ? ` — ${u.title}` : '');
    } else {
      roleBadge.className   = 'account-role-badge customer';
      roleBadge.textContent = 'Customer';
    }
  }

  renderPaymentTags(u.paymentMethods || []);
  renderAddressTags(u.savedAddresses || []);
  overlay.classList.add('visible');
}

/* =========================================================
   CHANGE PASSWORD MODAL
   ========================================================= */

function showChangePasswordModal() {
  let overlay = document.getElementById('changePwdModal');

  if (!overlay) {
    overlay           = document.createElement('div');
    overlay.id        = 'changePwdModal';
    overlay.className = 'account-modal-overlay';
    overlay.innerHTML = `
      <div class="account-modal-card change-pwd-card" style="max-width:440px">
        <div class="change-pwd-modal-head">
          <button class="change-pwd-head-close" id="changePwdClose" type="button">✕</button>
          <div class="change-pwd-lock">🔐</div>
          <h2 class="change-pwd-heading">Change Password</h2>
          <p class="change-pwd-tagline">Keep your account sweet and secure</p>
        </div>
        <div class="account-modal-body">
          <div class="account-field">
            <label>Current Password</label>
            <div class="account-field-row">
              <input type="password" id="cpOldPwd" placeholder="Current password" autocomplete="current-password" />
            </div>
          </div>
          <div class="account-field">
            <label>New Password <small>(min. 6 characters)</small></label>
            <div class="account-field-row">
              <input type="password" id="cpNewPwd" placeholder="New password" autocomplete="new-password" />
              <button class="account-show-toggle" id="cpToggleBtn" type="button">Show</button>
            </div>
          </div>
          <div class="account-field">
            <label>Confirm New Password</label>
            <div class="account-field-row">
              <input type="password" id="cpConfirmPwd" placeholder="Confirm new password" autocomplete="new-password" />
            </div>
          </div>
          <div id="cpOtpRow" style="display:none">
            <div class="account-field">
              <label>Verification Code <small>(sent to your email)</small></label>
              <div class="account-field-row">
                <input type="text" id="cpOtpCode" placeholder="6-digit code" maxlength="6" autocomplete="one-time-code"
                       style="letter-spacing:0.2em;text-align:center" />
                <button class="account-add-btn" id="cpSendCodeBtn" type="button">Send Code</button>
              </div>
            </div>
          </div>
          <button class="account-save-btn" id="cpSaveBtn" type="button">Update Password</button>
          <div class="account-saved-badge" id="cpSavedBadge">✓ Password changed successfully</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('changePwdClose').addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });

    document.getElementById('cpToggleBtn').addEventListener('click', () => {
      const pwd = document.getElementById('cpNewPwd');
      pwd.type  = pwd.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('cpNewPwd').addEventListener('input', () => {
      document.getElementById('cpOtpRow').style.display =
        document.getElementById('cpNewPwd').value.trim() ? 'block' : 'none';
    });

    document.getElementById('cpSendCodeBtn').addEventListener('click', async () => {
      const u = getCurrentUserData();
      if (!u) return;
      const btn = document.getElementById('cpSendCodeBtn');
      btn.disabled = true; btn.textContent = 'Sending…';
      const res = await apiPost('/otp.php?action=send', { email: u.email, purpose: 'change_password' });
      btn.disabled = false; btn.textContent = 'Send Code';
      if (!res.ok) { showNotification(res.error || 'Failed to send code.', 'error'); return; }
      showNotification('Verification code sent to ' + u.email, 'success');
    });

    document.getElementById('cpSaveBtn').addEventListener('click', async () => {
      const oldPwd    = document.getElementById('cpOldPwd').value.trim();
      const newPwd    = document.getElementById('cpNewPwd').value.trim();
      const confirmPwd = document.getElementById('cpConfirmPwd').value.trim();
      const otpCode   = document.getElementById('cpOtpCode').value.trim();

      if (!oldPwd)              { showNotification('Please enter your current password.', 'warning'); return; }
      if (!newPwd)              { showNotification('Please enter a new password.', 'warning'); return; }
      if (newPwd.length < 6)    { showNotification('Password must be at least 6 characters.', 'warning'); return; }
      if (newPwd !== confirmPwd) { showNotification('Passwords do not match.', 'warning'); return; }
      if (!otpCode)             { showNotification('Please send and enter the verification code.', 'warning'); return; }

      const btn = document.getElementById('cpSaveBtn');
      btn.disabled = true; btn.textContent = 'Updating…';

      const res = await apiPost('/users.php?action=update', {
        password: newPwd, oldPassword: oldPwd,
        confirmPassword: confirmPwd, otpCode,
      });

      btn.disabled = false; btn.textContent = 'Update Password';

      if (!res.ok) { showNotification(res.error || 'Failed to change password.', 'error'); return; }
      _user = res.user;

      document.getElementById('cpOldPwd').value     = '';
      document.getElementById('cpNewPwd').value     = '';
      document.getElementById('cpConfirmPwd').value = '';
      document.getElementById('cpOtpCode').value    = '';
      document.getElementById('cpOtpRow').style.display = 'none';

      const badge = document.getElementById('cpSavedBadge');
      badge.classList.add('show');
      setTimeout(() => { badge.classList.remove('show'); overlay.classList.remove('visible'); }, 2000);
    });
  }

  document.getElementById('cpOldPwd').value     = '';
  document.getElementById('cpNewPwd').value     = '';
  document.getElementById('cpConfirmPwd').value = '';
  document.getElementById('cpOtpCode').value    = '';
  document.getElementById('cpOtpRow').style.display = 'none';
  document.getElementById('cpSavedBadge').classList.remove('show');

  overlay.classList.add('visible');
}

/* =========================================================
   CAROUSEL
   ========================================================= */

function setupCarousel() {
  const carousel = document.getElementById('cakeCarousel');
  if (!carousel) return;

  const track       = carousel.querySelector('.carousel-track');
  const slides      = Array.from(track.children);
  const dotsWrapper = document.getElementById('carouselDots');
  const dots        = dotsWrapper ? Array.from(dotsWrapper.children) : [];
  let currentIndex  = 0;
  let autoSlideTimer;

  function updateCarousel(index) {
    currentIndex          = (index + slides.length) % slides.length;
    track.style.transform = `translateX(${-currentIndex * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => updateCarousel(i)));

  function startAuto() {
    clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(() => updateCarousel(currentIndex + 1), 7000);
  }

  carousel.addEventListener('mouseenter', () => clearInterval(autoSlideTimer));
  carousel.addEventListener('mouseleave', startAuto);

  const miniPrev = carousel.querySelector('.mini-prev');
  const miniNext = carousel.querySelector('.mini-next');
  if (miniPrev && miniNext && dots.length) {
    const getActiveIndex = () => dots.findIndex((d) => d.classList.contains('active'));
    const goTo = (i) => dots[(i + dots.length) % dots.length].click();
    miniPrev.addEventListener('click', () => goTo(getActiveIndex() - 1));
    miniNext.addEventListener('click', () => goTo(getActiveIndex() + 1));
  }

  updateCarousel(0);
  startAuto();
}

/* =========================================================
   CONTACT FORM
   ========================================================= */

function setupContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const fileInput     = document.getElementById('cakePhoto');
  const fileNameLabel = document.getElementById('fileName');
  if (fileInput && fileNameLabel) {
    fileInput.addEventListener('change', () => {
      fileNameLabel.textContent = fileInput.files?.length ? fileInput.files[0].name : 'No file chosen';
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showNotification("Thank you! We'll get back to you soon.", 'success');
    form.reset();
    if (fileNameLabel) fileNameLabel.textContent = 'No file chosen';
  });

  setupFeedbackForm();
}

/* =========================================================
   CUSTOMER FEEDBACK
   ========================================================= */

async function renderFeedbackReviews() {
  const grid = document.getElementById('feedbackReviewsGrid');
  if (!grid) return;

  try {
    const res = await apiGet('/feedbacks.php');
    if (!res.ok || !res.feedbacks.length) {
      grid.innerHTML = '<p class="feedback-no-reviews">No reviews yet. Be the first to share your experience!</p>';
      return;
    }
    grid.innerHTML = res.feedbacks.map((fb) => {
      const stars = '★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating);
      return `
        <div class="feedback-review-card">
          <div class="feedback-review-stars">${stars}</div>
          <div class="feedback-review-text">"${fb.comment}"</div>
          <div class="feedback-review-meta">${fb.name}${fb.occasion ? ` · ${fb.occasion}` : ''} · ${fb.date}</div>
        </div>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="feedback-no-reviews">Could not load reviews.</p>';
  }
}

async function userHasOrdered() {
  try {
    const res = await apiGet('/orders.php?action=has_ordered');
    return res.ok && res.hasOrdered;
  } catch { return false; }
}

function showFeedbackGate(reason) {
  let gate = document.getElementById('feedbackGate');
  if (gate) { gate.classList.add('visible'); return; }

  gate           = document.createElement('div');
  gate.id        = 'feedbackGate';
  gate.className = 'auth-gate-overlay';

  const isGuest = reason === 'guest';
  gate.innerHTML = `
    <div class="auth-gate-card">
      <h3 class="auth-gate-title">${isGuest ? 'Sign in to review' : 'Order first!'}</h3>
      <p class="auth-gate-text">
        ${isGuest
          ? 'Please log in or create an account to share your experience.'
          : 'You can leave a review after placing your first order with us.'}
      </p>
      <div class="auth-gate-actions">
        ${isGuest
          ? `<a href="/html/login.html" class="btn btn-primary">Log in</a>
             <a href="/html/login.html" class="btn btn-outline">Create account</a>`
          : `<a href="/html/menu.html" class="btn btn-primary">Browse menu</a>`}
      </div>
      <button class="auth-gate-dismiss" id="feedbackGateDismiss">Maybe later</button>
    </div>
  `;
  document.body.appendChild(gate);
  document.getElementById('feedbackGateDismiss').addEventListener('click', () => gate.classList.remove('visible'));
  gate.addEventListener('click', (e) => { if (e.target === gate) gate.classList.remove('visible'); });
  gate.classList.add('visible');
}

function setupFeedbackForm() {
  const feedbackForm = document.getElementById('feedbackForm');
  if (!feedbackForm) return;

  const user        = getCurrentUserData();
  const nameInput   = document.getElementById('feedbackName');
  const stars       = document.querySelectorAll('.feedback-star');
  const ratingInput = document.getElementById('feedbackRating');

  renderFeedbackReviews();

  if (user && nameInput) nameInput.value = user.name || '';

  feedbackForm.querySelectorAll('input:not([type=hidden]), textarea').forEach((input) => {
    input.addEventListener('focus', (e) => {
      if (!getCurrentUser()) { e.target.blur(); showFeedbackGate('guest'); }
    });
  });

  let selectedRating = 0;

  stars.forEach((star) => {
    star.addEventListener('mouseenter', () => {
      if (!getCurrentUser()) return;
      const val = parseInt(star.dataset.star);
      stars.forEach((s) => s.classList.toggle('active', parseInt(s.dataset.star) <= val));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach((s) => s.classList.toggle('active', parseInt(s.dataset.star) <= selectedRating));
    });
    star.addEventListener('click', () => {
      if (!getCurrentUser()) { showFeedbackGate('guest'); return; }
      selectedRating    = parseInt(star.dataset.star);
      ratingInput.value = selectedRating;
      stars.forEach((s) => s.classList.toggle('active', parseInt(s.dataset.star) <= selectedRating));
    });
  });

  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!getCurrentUser()) { showFeedbackGate('guest'); return; }

    const hasOrdered = await userHasOrdered();
    if (!hasOrdered) { showFeedbackGate('no-order'); return; }

    const rating   = parseInt(ratingInput.value);
    const name     = document.getElementById('feedbackName').value.trim();
    const occasion = document.getElementById('feedbackOccasion').value.trim();
    const comment  = document.getElementById('feedbackComment').value.trim();

    if (!rating)  { showNotification('Please select a star rating.', 'warning'); return; }
    if (!name)    { showNotification('Please enter your name.', 'warning'); return; }
    if (!comment) { showNotification('Please write a comment.', 'warning'); return; }

    const submitBtn = feedbackForm.querySelector('.feedback-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    const res = await apiPost('/feedbacks.php', { rating, name, occasion, comment });

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Feedback'; }

    if (!res.ok) { showNotification(res.error || 'Could not submit feedback.', 'error'); return; }

    renderFeedbackReviews();
    feedbackForm.reset();
    selectedRating    = 0;
    ratingInput.value = 0;
    stars.forEach((s) => s.classList.remove('active'));
    if (user && nameInput) nameInput.value = user.name || '';
    showNotification('Thank you for your feedback!', 'success');
  });

  if (!getCurrentUser()) {
    const hint     = document.createElement('div');
    hint.className = 'feedback-guest-hint';
    hint.innerHTML = `<a href="/html/login.html">Sign in</a> and place an order to leave a review.`;
    feedbackForm.parentElement.insertBefore(hint, feedbackForm);
  }
}

/* =========================================================
   FEATURED REVIEWS (HOME PAGE)
   ========================================================= */

async function renderFeaturedReviews() {
  const grid = document.getElementById('featuredReviewsGrid');
  if (!grid) return;

  try {
    const res = await apiGet('/feedbacks.php?action=featured');
    if (!res.ok || !res.feedbacks.length) {
      grid.innerHTML = '';
      return;
    }
    grid.innerHTML = res.feedbacks.map((fb) => {
      const stars    = '★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating);
      const initials = (fb.name || 'A').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      return `
        <div class="testimonial-card">
          <div class="testimonial-quote-mark">"</div>
          <div class="testimonial-text">${fb.comment}</div>
          <div class="testimonial-footer">
            <div class="testimonial-avatar-wrap">
              <div class="testimonial-avatar">
                <div class="testimonial-avatar-initials" style="display:flex">${initials}</div>
              </div>
              <div class="testimonial-meta">
                <div class="testimonial-name">${fb.name}</div>
                ${fb.occasion ? `<div class="testimonial-occasion">${fb.occasion}</div>` : ''}
              </div>
            </div>
            <div class="testimonial-stars">${stars}</div>
          </div>
        </div>`;
    }).join('');
  } catch {
    grid.innerHTML = '';
  }
}

/* =========================================================
   FORGOT PASSWORD MODAL
   ========================================================= */

function showForgotPasswordModal() {
  let overlay = document.getElementById('forgotModal');

  if (!overlay) {
    overlay           = document.createElement('div');
    overlay.id        = 'forgotModal';
    overlay.className = 'account-modal-overlay';
    overlay.innerHTML = `
      <div class="account-modal-card" style="max-width:420px">
        <div class="account-modal-header">
          <h2 class="account-modal-title">Reset Password</h2>
          <button class="account-modal-close" id="forgotModalClose" type="button">✕</button>
        </div>
        <div class="account-modal-body">

          <div id="forgotStep1">
            <p style="font-size:0.88rem;color:#7a6675;margin-bottom:1.2rem">
              Enter your account email and we'll send you a 6-digit verification code.
            </p>
            <div class="account-field">
              <label>Email Address</label>
              <div class="account-field-row">
                <input type="email" id="forgotEmail" placeholder="your@email.com" />
              </div>
            </div>
            <button class="account-save-btn" id="forgotSendCodeBtn" type="button">Send Code</button>
          </div>

          <div id="forgotStep2" style="display:none">
            <p style="font-size:0.88rem;color:#7a6675;margin-bottom:1.2rem">
              Enter the 6-digit code sent to your email, then set your new password.
            </p>
            <div class="account-field">
              <label>Verification Code</label>
              <div class="account-field-row">
                <input type="text" id="forgotCode" placeholder="6-digit code" maxlength="6"
                       style="letter-spacing:0.25em;text-align:center" />
              </div>
            </div>
            <div class="account-field">
              <label>New Password</label>
              <div class="account-field-row">
                <input type="password" id="forgotPassword" placeholder="New password (min. 6 characters)" />
              </div>
            </div>
            <div class="account-field">
              <label>Confirm New Password</label>
              <div class="account-field-row">
                <input type="password" id="forgotConfirm" placeholder="Confirm new password" />
              </div>
            </div>
            <button class="account-save-btn" id="forgotSubmitBtn" type="button">Reset Password</button>
            <button id="forgotBackBtn" type="button"
                    style="display:block;margin-top:0.7rem;width:100%;background:none;border:none;
                           color:#7a5fa8;font-size:0.85rem;cursor:pointer">← Back</button>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('forgotModalClose').addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });

    document.getElementById('forgotSendCodeBtn').addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
      if (!email) { showNotification('Please enter your email address.', 'warning'); return; }

      const btn = document.getElementById('forgotSendCodeBtn');
      btn.disabled = true; btn.textContent = 'Sending…';
      const res = await apiPost('/auth.php?action=forgot_password', { email });
      btn.disabled = false; btn.textContent = 'Send Code';

      if (!res.ok) { showNotification(res.error || 'Could not send code.', 'error'); return; }

      showNotification('Verification code sent to ' + email, 'success');
      document.getElementById('forgotStep1').style.display = 'none';
      document.getElementById('forgotStep2').style.display = 'block';
    });

    document.getElementById('forgotBackBtn').addEventListener('click', () => {
      document.getElementById('forgotStep1').style.display = 'block';
      document.getElementById('forgotStep2').style.display = 'none';
      document.getElementById('forgotCode').value          = '';
      document.getElementById('forgotPassword').value      = '';
      document.getElementById('forgotConfirm').value       = '';
    });

    document.getElementById('forgotSubmitBtn').addEventListener('click', async () => {
      const email    = document.getElementById('forgotEmail').value.trim().toLowerCase();
      const code     = document.getElementById('forgotCode').value.trim();
      const password = document.getElementById('forgotPassword').value.trim();
      const confirm  = document.getElementById('forgotConfirm').value.trim();

      if (!code)               { showNotification('Please enter the verification code.', 'warning'); return; }
      if (!password)           { showNotification('Please enter a new password.', 'warning'); return; }
      if (password.length < 6) { showNotification('Password must be at least 6 characters.', 'warning'); return; }
      if (password !== confirm) { showNotification('Passwords do not match.', 'warning'); return; }

      const btn       = document.getElementById('forgotSubmitBtn');
      btn.disabled    = true;
      btn.textContent = 'Resetting…';

      const res = await apiPost('/auth.php?action=forgot_password', { email, code, password, confirmPassword: confirm });

      btn.disabled    = false;
      btn.textContent = 'Reset Password';

      if (!res.ok) { showNotification(res.error || 'Invalid or expired code.', 'error'); return; }

      showNotification('Password reset successfully. You can now log in.', 'success');
      overlay.classList.remove('visible');
    });
  }

  document.getElementById('forgotEmail').value       = '';
  document.getElementById('forgotCode').value        = '';
  document.getElementById('forgotPassword').value    = '';
  document.getElementById('forgotConfirm').value     = '';
  document.getElementById('forgotStep1').style.display = 'block';
  document.getElementById('forgotStep2').style.display = 'none';
  overlay.classList.add('visible');
}

/* =========================================================
   MY ORDERS MODAL (separate from account details)
   ========================================================= */

function showMyOrdersModal() {
  let overlay = document.getElementById('myOrdersModal');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'account-modal-overlay';
    overlay.id = 'myOrdersModal';
    overlay.innerHTML = `
      <div class="account-modal-card">
        <div class="account-modal-header">
          <h2 class="account-modal-title">My Orders</h2>
          <button class="account-modal-close" id="myOrdersModalClose" type="button">✕</button>
        </div>
        <div class="account-modal-body">
          <div id="myOrdersContent"><span class="account-empty-hint">Loading…</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('myOrdersModalClose').addEventListener('click', () => overlay.classList.remove('visible'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });
  }

  overlay.classList.add('visible');
  loadMyOrders();
}

async function loadMyOrders() {
  const container = document.getElementById('myOrdersContent');
  if (!container) return;
  container.innerHTML = '<span class="account-empty-hint">Loading orders…</span>';

  try {
    const res = await apiGet('/orders.php');
    if (!res.ok || !res.orders?.length) {
      container.innerHTML = '<span class="account-empty-hint">No orders yet.</span>';
      return;
    }

    const statusMap = { pending:'#856404', processing:'#084298', 'ready-for-pickup':'#0a3622', delivered:'#4a3668', cancelled:'#842029' };
    const bgMap     = { pending:'#fff3cd', processing:'#cfe2ff', 'ready-for-pickup':'#d1e7dd', delivered:'#e8d5ff', cancelled:'#f8d7da' };

    container.innerHTML = res.orders.map(o => {
      const d       = new Date(o.date || o.created_at);
      const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
      const status  = o.status || 'pending';

      const items = (o.items || []).map(item => `
        <div class="account-order-item-row" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.25rem 0">
          <span style="font-size:0.85rem">${item.name} × ${item.qty || 1}
            <span style="color:#7a6675"> — ₱${(parseFloat(item.price || 0) * (item.qty || 1)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </span>
          ${status === 'pending' ? `<button class="cancel-item-btn"
              data-order-id="${o.id || o.order_ref}" data-item-id="${item.id}"
              style="font-size:0.75rem;padding:0.2rem 0.6rem;border:none;background:#f8d7da;color:#842029;border-radius:6px;cursor:pointer;flex-shrink:0">
            Cancel Item
          </button>` : ''}
        </div>`).join('');

      return `
        <div class="account-order-card">
          <div class="account-order-top">
            <span class="account-order-id">${o.id || o.order_ref}</span>
            <span class="account-order-status"
                  style="background:${bgMap[status]||'#e8d5ff'};color:${statusMap[status]||'#4a3668'}">
              ${status.replace(/-/g, ' ')}
            </span>
          </div>
          <div class="account-order-meta">${dateStr} · ₱${parseFloat(o.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${o.payment || ''}</div>
          <div class="account-order-items-list">${items}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.cancel-item-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this item from your order?')) return;
        btn.disabled = true; btn.textContent = 'Cancelling…';
        const res = await apiPost('/orders.php?action=cancel_item', {
          orderId: btn.dataset.orderId,
          itemId:  parseInt(btn.dataset.itemId),
        });
        if (!res.ok) {
          showNotification(res.error || 'Could not cancel item.', 'error');
          btn.disabled = false; btn.textContent = 'Cancel Item';
          return;
        }
        showNotification(res.orderDeleted ? 'Item cancelled — order removed.' : 'Item cancelled.', 'success');
        loadMyOrders();
      });
    });
  } catch {
    container.innerHTML = '<span class="account-empty-hint">Could not load orders.</span>';
  }
}

/* =========================================================
   DEAL BUTTON (floating, bottom-left)
   ========================================================= */

function initDealButton() {
  if (document.body.dataset.page === 'login') return;
  const btn = document.createElement('button');
  btn.id        = 'dealBtn';
  btn.className = 'deal-btn';
  btn.setAttribute('aria-label', 'Claim Deal');
  btn.innerHTML = `<span class="deal-btn-pct">10%</span><span class="deal-btn-label">Deal</span>`;
  document.body.appendChild(btn);

  btn.addEventListener('click', () => openDealModal());
}

async function openDealModal() {
  let overlay = document.getElementById('dealModal');
  if (overlay) { overlay.remove(); }

  overlay = document.createElement('div');
  overlay.id        = 'dealModal';
  overlay.className = 'account-modal-overlay';
  document.body.appendChild(overlay);

  const user = getCurrentUserData();

  if (user) {
    overlay.innerHTML = buildDealModalHtml('loading', null);
    overlay.classList.add('visible');
    attachDealModalClose(overlay);

    const res = await apiPost('/vouchers.php?action=claim', {});
    if (!res.ok) {
      overlay.innerHTML = buildDealModalHtml('error', null);
    } else if (res.used) {
      overlay.innerHTML = buildDealModalHtml('used', res.code);
    } else {
      overlay.innerHTML = buildDealModalHtml('claim', res.code);
    }
    attachDealModalClose(overlay);
  } else {
    overlay.innerHTML = buildDealModalHtml('subscribe', null);
    overlay.classList.add('visible');
    attachDealModalClose(overlay);

    const form = document.getElementById('dealSubscribeForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name  = document.getElementById('dealName').value.trim();
        const email = document.getElementById('dealEmail').value.trim().toLowerCase();
        if (!name || !email) { showNotification('Please enter your name and email.', 'warning'); return; }
        const submitBtn = form.querySelector('button[type=submit]');
        submitBtn.disabled = true; submitBtn.textContent = 'Subscribing…';
        const res = await apiPost('/vouchers.php?action=subscribe', { name, email });
        submitBtn.disabled = false; submitBtn.textContent = 'Get My Voucher';
        if (!res.ok) { showNotification(res.error || 'Failed. Try again.', 'error'); return; }
        overlay.innerHTML = buildDealModalHtml(res.alreadyClaimed ? 'already' : 'claimed', res.code);
        attachDealModalClose(overlay);
      });
    }
  }
}

function attachDealModalClose(overlay) {
  const closeBtn = document.getElementById('dealModalClose');
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('visible'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });
}

function buildDealModalHtml(type, code) {
  const close  = `<button class="account-modal-close" id="dealModalClose" type="button">✕</button>`;
  const header = `<div class="account-modal-header"><h2 class="account-modal-title">Special Deal</h2>${close}</div>`;

  if (type === 'loading') {
    return `<div class="account-modal-card" style="max-width:400px">${header}<div class="account-modal-body" style="text-align:center;padding:2rem;color:#7a6675">Loading…</div></div>`;
  }

  if (type === 'subscribe') {
    return `<div class="account-modal-card" style="max-width:400px">
      ${header}
      <div class="account-modal-body">
        <div style="text-align:center;margin-bottom:1.2rem">
          <div style="font-size:3rem;font-weight:800;color:#7a5fa8;line-height:1">10% OFF</div>
          <div style="color:#7a6675;font-size:0.9rem;margin-top:0.3rem">your first order!</div>
        </div>
        <p style="font-size:0.87rem;color:#3d3047;margin-bottom:1rem;text-align:center">
          Subscribe with your name and email to receive your exclusive voucher code.
        </p>
        <form id="dealSubscribeForm">
          <input type="text"  id="dealName"  class="checkout-input" placeholder="Your name *" required />
          <input type="email" id="dealEmail" class="checkout-input" placeholder="Email address *" required style="margin-top:0.5rem" />
          <button type="submit" class="account-save-btn" style="margin-top:1rem">Get My Voucher</button>
        </form>
      </div>
    </div>`;
  }

  if (type === 'claim') {
    return `<div class="account-modal-card" style="max-width:400px">
      ${header}
      <div class="account-modal-body" style="text-align:center">
        <div style="font-size:3rem;font-weight:800;color:#7a5fa8;margin-bottom:0.3rem;line-height:1">10% OFF</div>
        <div style="color:#7a6675;font-size:0.9rem;margin-bottom:1.4rem">your first order!</div>
        <p style="font-size:0.87rem;color:#3d3047;margin-bottom:0.8rem">Your voucher code:</p>
        <div style="font-size:1.5rem;font-weight:700;letter-spacing:0.2em;color:#7a5fa8;background:#f5f0ff;border-radius:14px;padding:16px">${code}</div>
        <p style="color:#9a849f;font-size:0.8rem;margin-top:1rem">Enter this code at checkout. Valid for 30 days.</p>
      </div>
    </div>`;
  }

  if (type === 'claimed' || type === 'already') {
    return `<div class="account-modal-card" style="max-width:400px">
      ${header}
      <div class="account-modal-body" style="text-align:center">
        <p style="color:#3d3047;font-size:0.95rem;margin-bottom:0.8rem">
          ${type === 'already' ? 'You already have a voucher!' : 'Your voucher has been sent to your email!'}
        </p>
        <div style="font-size:1.5rem;font-weight:700;letter-spacing:0.2em;color:#7a5fa8;background:#f5f0ff;border-radius:14px;padding:16px">${code}</div>
        <p style="color:#9a849f;font-size:0.8rem;margin-top:1rem">Enter this code at checkout. Valid for 30 days.</p>
      </div>
    </div>`;
  }

  if (type === 'used') {
    return `<div class="account-modal-card" style="max-width:400px">
      ${header}
      <div class="account-modal-body" style="text-align:center">
        <p style="color:#3d3047;font-size:0.95rem;margin-bottom:1rem">You have already used your first-order voucher!</p>
        <p style="color:#7a6675;font-size:0.85rem">Stay tuned for more deals and promotions.</p>
      </div>
    </div>`;
  }

  return `<div class="account-modal-card">${header}<div class="account-modal-body"><p style="color:#842029">Something went wrong. Please try again.</p></div></div>`;
}
