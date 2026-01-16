// ALL SCRIPTS:

// AUTH.JS

const DEV_MOCK_AUTH = false; // <-- set to true for local testing only


(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  if (!window.APP_CONFIG) {
    console.error("APP_CONFIG not loaded. Make sure config.js is included first.");
    return;
  }

  const {
    COGNITO_DOMAIN,
    CLIENT_ID,
    REDIRECT_URI
  } = window.APP_CONFIG;

  if (!COGNITO_DOMAIN || !CLIENT_ID || !REDIRECT_URI) {
    console.error("Missing required Cognito configuration values.");
    return;
  }

  // ---------------------------------------------------------------------------
  // Auth State
  // ---------------------------------------------------------------------------
  function isAuthenticated() {
    if (DEV_MOCK_AUTH) return true;
    return !!sessionStorage.getItem("id_token");
  }

  // ---------------------------------------------------------------------------
  // OAuth URL Builder
  // ---------------------------------------------------------------------------
  function buildOAuthUrl(path) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      scope: "email openid profile",
      redirect_uri: REDIRECT_URI
    });

    return `${COGNITO_DOMAIN}/${path}?${params.toString()}`;
  }

  // ---------------------------------------------------------------------------
  // UI Setup
  // ---------------------------------------------------------------------------
  function setupAuthLinks() {
    const signInBtn = document.getElementById("signin-btn");
    if (signInBtn) {
      signInBtn.setAttribute("href", buildOAuthUrl("login"));
    }

    const signUpBtn = document.getElementById("signup-btn");
    if (signUpBtn) {
      signUpBtn.setAttribute("href", buildOAuthUrl("signup"));
    }
  }

  function updateAuthUI() {
    const anonSection = document.getElementById("auth-anon");
    const userSection = document.getElementById("auth-user");

    if (!anonSection || !userSection) return;

    if (isAuthenticated()) {
      anonSection.classList.add("d-none");
      userSection.classList.remove("d-none");
    } else {
      userSection.classList.add("d-none");
      anonSection.classList.remove("d-none");
    }
  }

  // ---------------------------------------------------------------------------
  // Sign Out
  // ---------------------------------------------------------------------------
  function setupSignOut() {
    const signOutBtn = document.getElementById("signout-btn");
    if (!signOutBtn) return;

    signOutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Clear local session
      sessionStorage.clear();

      // Redirect through Cognito logout
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        logout_uri: window.location.origin
      });

      window.location.href = `${COGNITO_DOMAIN}/logout?${params.toString()}`;
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    setupAuthLinks();
    setupSignOut();
    updateAuthUI();
  });

})();


// CART-PAGE.JS

class CartPageManager {
  constructor() {
    this.cart = null;
    this.currentEditingProduct = null;
    this.updateModal = null;

    this.config = window.API_CONFIG;
    this.mockRouter = this.config.USE_MOCK_API
      ? new window.MockRouter(this.config.MOCK_API_BASE)
      : null;
  }

  // ----------------------
  // API Fetch Function
  // ----------------------

  async apiFetch(method, endpoint, options = {}) {
    let url;

    // Mock
    if (this.config.USE_MOCK_API) {
      url = this.mockRouter.resolve(method, endpoint);

      await new Promise(r => setTimeout(r, 300));

      try {
        const response = await fetch(url);

        if (!response.ok) throw new Error(`Mock API error: ${response.status}`);
        
        const data = await response.json();

        return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data)
        };
      } catch (error) {
        console.error('Mock API fetch error:', error);
        throw error;
      }
    }

    // Real
    url = `${this.config.REAL_API_BASE}${endpoint}`;

    return fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body
    });
  }


  // ----------------------
  // Initialize Page
  // ----------------------

  async init() {

    // Initialize Bootstrap modal
    const modalElement = document.getElementById('updateWeightModal');
    this.updateModal = new bootstrap.Modal(modalElement);

    // Setup event listeners
    this.setupEventListeners();

    // Load cart
    await this.loadCart();

    // Log mode for debugging
    console.log(`Cart Page initialized in ${this.config.USE_MOCK_API ? 'MOCK' : 'REAL'} API mode`);
  }

  setupEventListeners() {

    // Clear cart button
    const clearBtn = document.getElementById('clearCartBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.confirmClearCart());
    }

    // Confirm update button in modal
    const confirmBtn = document.getElementById('confirmUpdateBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.updateCartItem());
    }

    // Weight select change in modal
    const weightSelect = document.getElementById('newWeightSelect');
    if (weightSelect) {
      weightSelect.addEventListener('change', () => this.updateModalPrice());
    }

    // Checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.proceedToCheckout());
    }
  }


  // ----------------------
  // Load Cart Function
  // ----------------------
  
  async loadCart() {
    try {
      this.showLoading();

      const response = await this.apiFetch('GET', '/cart');

      if (!response.ok) throw new Error('Failed to fetch cart');

      const data = await response.json();
      this.cart = data.cart;

      this.renderCart();
      this.updateCartBadge();
      
    } catch (error) {console.error('Error loading cart:', error);
      this.showError('Failed to load cart. Please refresh the page.');
    }
  }


  // ----------------------
  // Render Cart
  // ----------------------
  
  renderCart() {
    const loadingState = document.getElementById('loadingState');
    const emptyCart = document.getElementById('emptyCart');
    const cartItems = document.getElementById('cartItems');
    const orderSummary = document.getElementById('orderSummary');

    loadingState.style.display = 'none';

    if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
      emptyCart.style.display = 'block';
      cartItems.style.display = 'none';
      orderSummary.style.display = 'none';
      return;
    }

    emptyCart.style.display = 'none';
    cartItems.style.display = 'block';
    orderSummary.style.display = 'block';

    // Render cart items
    const itemsList = document.getElementById('cartItemsList');
    itemsList.innerHTML = '';

    this.cart.items.forEach((item, index) => {
      const row = this.createCartItemRow(item, index);
      itemsList.appendChild(row);
    });

    // Update summary
    this.updateOrderSummary();
  }

  // Create cart item row
  createCartItemRow(item, index) {
    const tr = document.createElement('tr');
    tr.className = 'cart-item-row';
    tr.dataset.productId = item.productId;

    const weightKg = item.weightGrams >= 1000 ? 
      `${(item.weightGrams / 1000).toFixed(1)}kg` : 
      `${item.weightGrams}g`;

    tr.innerHTML = `
      <td class="px-4 py-3">
        <h6 class="mb-0">${item.productName}</h6>
        <small class="text-muted">SKU: ${item.productId}</small>
      </td>
      <td class="py-3 text-center">
        <span class="badge bg-secondary">${weightKg}</span>
      </td>
      <td class="py-3 text-end">
        $${item.pricePerUnit.toFixed(2)}
      </td>
      <td class="py-3 text-end">
        <strong>$${item.totalPrice.toFixed(2)}</strong>
      </td>
      <td class="py-3 text-center">
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-primary edit-btn" 
                  data-product-id="${item.productId}" 
                  data-current-weight="${item.weightGrams}"
                  data-price-per-unit="${item.pricePerUnit}"
                  title="Update quantity">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger delete-btn" 
                  data-product-id="${item.productId}"
                  data-product-name="${item.productName}"
                  title="Remove item">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    // Add event listeners
    const editBtn = tr.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => this.showUpdateModal(item));

    const deleteBtn = tr.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => this.removeItem(item.productId, item.productName));

    return tr;
  }

  // Show update weight modal
  showUpdateModal(item) {
    this.currentEditingProduct = item;

    // Set current weight in modal
    document.getElementById('currentWeight').textContent = 
      `${item.weightGrams}g (${(item.weightGrams / 1000).toFixed(2)}kg)`;

    // Set select to current weight
    const weightSelect = document.getElementById('newWeightSelect');
    weightSelect.value = item.weightGrams;

    // Update modal title
    document.getElementById('updateWeightModalLabel').textContent = 
      `Update ${item.productName}`;

    this.updateModalPrice();
    this.updateModal.show();
  }

  // Update price display in modal
  updateModalPrice() {
    const weightSelect = document.getElementById('newWeightSelect');
    const selectedWeight = parseInt(weightSelect.value);
    const pricePerUnit = this.currentEditingProduct.pricePerUnit;
    
    const totalPrice = (pricePerUnit * selectedWeight) / 100;
    
    document.getElementById('modalPrice').textContent = 
      `$${totalPrice.toFixed(2)} ($${pricePerUnit.toFixed(2)}/100g)`;
  }


  // ----------------------
  // Update Item Weight Function
  // ----------------------
  
  async updateCartItem() {
    const weightSelect = document.getElementById('newWeightSelect');
    const newWeight = parseInt(weightSelect.value);
    const productId = this.currentEditingProduct.productId;

    if (newWeight === this.currentEditingProduct.weightGrams) {
      this.updateModal.hide();
      return;
    }

    try {
      // Disable button
      const confirmBtn = document.getElementById('confirmUpdateBtn');
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

      const response = await this.apiFetch('PUT', `/cart/items/${productId}`, {
        body: JSON.stringify({
          productId: productId,
          weightGrams: newWeight
        })
      });

      if (!response.ok) throw new Error('Failed to update cart');

      const data = await response.json();
      this.cart = data.cart;

      // Success feedback
      this.showNotification('Cart updated successfully!', 'success');
      this.updateModal.hide();
      this.renderCart();
      this.updateCartBadge();

      // Reset button
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Update';

    } catch (error) {
      console.error('Error updating cart:', error);
      this.showNotification(error.message, 'error');

      // Reset button
      const confirmBtn = document.getElementById('confirmUpdateBtn');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Update';
    }
  }


  // ----------------------
  // Remove Item Function
  // ----------------------
  
  async removeItem(productId, productName) {
    if (!confirm(`Remove ${productName} from cart?`)) {
      return;
    }

    try {
      const response = await this.apiFetch('DELETE', `/cart/items/${productId}`);

      if (!response.ok) throw new Error('Failed to remove item');

      const data = await response.json();
      this.cart = data.cart;

      this.showNotification('Item removed from cart', 'success');
      this.renderCart();
      this.updateCartBadge();

    } catch (error) {
      console.error('Error removing item:', error);
      this.showNotification(error.message, 'error');
    }
  }


  // ----------------------
  // Clear Cart Function
  // ---------------------- 

  confirmClearCart() {
    if (!confirm('Are you sure you want to clear your entire cart? This cannot be undone.')) {
      return;
    }
    this.clearCart();
  }

  async clearCart() {
    try {
      const response = await this.apiFetch('DELETE', '/cart');

      if (!response.ok) throw new Error('Failed to clear cart');

      const data = await response.json();
      this.cart = data.cart;

      this.showNotification('Cart cleared', 'success');
      this.renderCart();
      this.updateCartBadge();

    } catch (error) {
      console.error('Error clearing cart:', error);
      this.showNotification(error.message, 'error');
    }
  }


  // ----------------------
  // Helpers
  // ---------------------- 

  // Update order summary
  updateOrderSummary() {
    const itemCount = this.cart.itemCount || 0;
    const totalWeight = this.cart.totalWeight || 0;
    const subtotal = this.cart.subtotal || 0;

    document.getElementById('summaryItemCount').textContent = itemCount;
    
    const weightDisplay = totalWeight >= 1000 ? 
      `${(totalWeight / 1000).toFixed(2)}kg` : 
      `${totalWeight}g`;
    document.getElementById('summaryTotalWeight').textContent = weightDisplay;
    
    document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
  }

  // Update cart badge in navigation
  updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge && this.cart) {
      const itemCount = this.cart.itemCount || 0;
      badge.textContent = itemCount;
    }
  }

  // Show loading state
  showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('emptyCart').style.display = 'none';
    document.getElementById('cartItems').style.display = 'none';
    document.getElementById('orderSummary').style.display = 'none';
  }

  // Show error message
  showError(message) {
    const loadingState = document.getElementById('loadingState');
    loadingState.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        ${message}
      </div>
    `;
  }

  // Show notification
  showNotification(message, type = 'success') {
    // Remove existing notifications
    const existing = document.querySelector('.cart-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification
    const notification = document.createElement('div');
    notification.className = `cart-notification cart-notification-${type}`;
    notification.innerHTML = `
      <div class="cart-notification-content">
        <i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'} me-2"></i>
        <span>${message}</span>
        ${this.config.USE_MOCK_API ? '<small class="ms-2 text-muted">(Mock)</small>' : ''}
      </div>
    `;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Hide and remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  // Proceed to checkout
  proceedToCheckout() {
    // Placeholder for checkout functionality
    this.showNotification('Checkout functionality coming soon!', 'success');
    // In production, redirect to checkout page:
    // window.location.href = '/checkout';
  }
}


const cartPageManager = new CartPageManager();


document.addEventListener('DOMContentLoaded', () => {
  cartPageManager.init();
});


// CART.JS

class CartManager {
  constructor() {
    this.cart = null;
    this.isLoading = false;

    this.config = window.API_CONFIG;
    this.mockRouter = this.config.USE_MOCK_API
      ? new window.MockRouter(this.config.MOCK_API_BASE)
      : null;
  }


  // ----------------------
  // API Fetch Function
  // ----------------------

  async apiFetch(method, endpoint, options = {}) {
    let url;

    // Mock
    if (this.config.USE_MOCK_API) {
      url = this.mockRouter.resolve(method, endpoint);

      await new Promise(r => setTimeout(r, 300));

      try {
        const response = await fetch(url);

        if (!response.ok) throw new Error(`Mock API error: ${response.status}`);
        
        const data = await response.json();

        return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data)
        };
      } catch (error) {
        console.error('Mock API fetch error:', error);
        throw error;
      }
    }

    // Real
    url = `${this.config.REAL_API_BASE}${endpoint}`;

    return fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body
    });
  }


  // ----------------------
  // Get Cart Function
  // ----------------------

  async getCart() {
    try {
      const response = await this.apiFetch('GET', '/cart');

      if (!response.ok) throw new Error('Failed to fetch cart');

      const data = await response.json();
      this.cart = data.cart;
      
      this.updateCartBadge();

      return this.cart;

    } catch (error) {console.error('Error fetching cart:', error);
      return null;
    }
  }


  // ----------------------
  // Add To Cart Function
  // ----------------------

  async addToCart(button, productId, weightGrams) {
    if (this.isLoading) return;

    this.isLoading = true;
    const originalText = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Adding...';

    const response = await this.apiFetch('POST', '/cart/items', {
        body: JSON.stringify({ productId, weightGrams })
      });

    if (!response.ok) throw new Error('Failed to add item');

    const data = await response.json();
    this.cart = data.cart;

    button.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Added!';
      button.classList.replace('btn-outline-dark', 'btn-success');

    this.updateCartBadge();
    this.showNotification('Item added to cart!', 'success');

    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.replace('btn-success', 'btn-outline-dark');
      if (button.dataset.soldOut !== "true") {
        button.disabled = false;
      }
    }, 2000);

    return data;

  } catch (error) {
    button.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i> Error';
    button.classList.add('btn-danger');

    this.showNotification(error.message, 'error');

    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.replace('btn-danger', 'btn-outline-dark');
      button.disabled = false;
    }, 3000);

  } finally {
    this.isLoading = false;
  }
}

  // ----------------------
  // UI Helpers
  // ----------------------

  updateCartBadge() {
    const badge = document.querySelector('.badge.bg-dark');
    if (!badge || !this.cart) return;

    badge.textContent = this.cart.itemCount || 0;
    badge.classList.add('cart-badge-update');

    setTimeout(() => badge.classList.remove('cart-badge-update'), 300);
  }

  showNotification(message, type = 'success') {
    const existing = document.querySelector('.cart-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `cart-notification cart-notification-${type}`;
    notification.innerHTML = `
      <div class="cart-notification-content">
        <i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'} me-2"></i>
        <span>${message}</span>
        ${this.config.USE_MOCK_API ? '<small class="ms-2 text-muted">(Mock)</small>' : ''}
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
}


const cartManager = new CartManager();


// ----------------------
// Add To Cart Button Setup
// ----------------------

function setupAddToCartButton() {
  const button = document.querySelector('.add-to-cart-btn');
  const product = document.querySelector('.product');
  const weightSelect = document.getElementById('weightSelect');

  if (!button || !product || !weightSelect) {
    console.error('Add-to-cart elements missing');
    return;
  }

  const productId = product.dataset.id;

  button.addEventListener('click', e => {
    e.preventDefault();

  if (button.disabled || button.dataset.soldOut === "true") {
    return;
  }

  const weightGrams = parseInt(weightSelect.value);

  try {
    cartManager.addToCart(button, productId, weightGrams);
  } catch (error) {
    console.error('Failed to add to cart:', error);
  }
});

  // Update price display when weight changes
  weightSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    console.log(`Selected: ${selectedOption.text}`);
  });
}

// ----------------------
// Buy Now Button Setup
// ----------------------

function setupBuyNowButtons() {
  const buttons = document.querySelectorAll('.buy-btn');

  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();

      if (
        button.disabled ||
        button.dataset.soldOut === "true"
      ) {
        return;
      }

      const url = button.dataset.url;

      if (!url) {
        console.error('Buy Now button missing data-url');
        return;
      }

      window.location.href = url;
    });
  });
}

// ----------------------
// Stock Check Button Update
// ----------------------

async function updateButtons() {
  const products = document.querySelectorAll('.product');
  if (!products.length) return;

  try {
    const response = await cartManager.apiFetch('GET', '/products');
    
    if (!response.ok) throw new Error('Products API error');

    const data = await response.json();

    products.forEach(product => {
      const productId = product.dataset.id;

      const cartButton = product.querySelector('.add-to-cart-btn');
      const buyButton  = product.querySelector('.buy-btn');

      const productData = data[productId];

      if (!productData) {
        console.warn(`No product data for ${productId}`);
        return;
      }

      if (productData.quantity === 0) {
        if (cartButton) {
          cartButton.textContent = 'Sold Out';
          cartButton.disabled = true;
          cartButton.dataset.soldOut = 'true';
        }

        if (buyButton) {
          buyButton.textContent = 'Sold Out';
          buyButton.disabled = true;
          buyButton.dataset.soldOut = 'true';
        }
      }
    });
  } catch (err) {
    console.error('Failed to update buttons:', err);
  }
}



// Load cart on page load
async function initializeCart() {
  try {
    await cartManager.getCart();
    
    // Log mode for debugging
    const config = window.API_CONFIG || { USE_MOCK_API: false };
    console.log(`Cart initialized in ${config.USE_MOCK_API ? 'MOCK' : 'REAL'} API mode`);
  } catch (error) {
    console.error('Failed to initialize cart:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeCart();
  setupAddToCartButton();
  setupBuyNowButtons();
  updateButtons();
});


// CONFIG.JS

//Cognito Config
window.APP_CONFIG = {

  COGNITO_DOMAIN: "https://YOUR_COGNITO_DOMAIN.auth.YOUR_REGION.amazoncognito.com",
  CLIENT_ID: "YOUR_COGNITO_APP_CLIENT_ID",
  REDIRECT_URI: "YOUR_DOMAIN/auth/callback.html",

};

(function validateConfig() {
  const requiredKeys = [
    "COGNITO_DOMAIN",
    "CLIENT_ID",
    "REDIRECT_URI"
  ];

  for (const key of requiredKeys) {
    if (
      !window.APP_CONFIG[key] ||
      window.APP_CONFIG[key].includes("YOUR_")
    ) {
      console.error(
        `[CONFIG ERROR] Missing or placeholder value for ${key} in /js/config.js`
      );
    }
  }
})();


// API Configuration
const API_CONFIG = {
  USE_MOCK_API: true,
  REAL_API_BASE: '/api',
  MOCK_API_BASE: '/mock'
};

window.API_CONFIG = API_CONFIG;


// MOCK-ROUTER.JS

(function () {

  class MockRouter {
    constructor(basePath = '/mock') {
      this.basePath = basePath;

      this.routes = [
        { method: 'GET',    path: '/cart',            file: 'cart.json' },
        { method: 'POST',   path: '/cart/items',      file: 'cart-add.json' },
        { method: 'PUT',    path: '/cart/items/:id',  file: 'cart-update.json' },
        { method: 'DELETE', path: '/cart/items/:id',  file: 'cart-delete.json' },
        { method: 'DELETE', path: '/cart',            file: 'cart-clear.json' },
        { method: 'GET',    path: '/products',        file: 'products.json' }
      ];
    }

    //Resolve a mock file based on HTTP method and endpoint
    resolve(method, endpoint) {
      const cleanEndpoint = this.stripQuery(endpoint);

      for (const route of this.routes) {
        if (route.method !== method) continue;

        // Exact match
        if (!route.path.includes(':') && route.path === cleanEndpoint) {
          return `${this.basePath}/${route.file}`;
        }

        // Wildcard match (e.g. /cart/:id)
        if (route.path.includes(':')) {
          const base = route.path.split('/:')[0];

          if (
            cleanEndpoint.startsWith(`${base}/`) &&
            cleanEndpoint.split('/').length === route.path.split('/').length
          ) {
            return `${this.basePath}/${route.file}`;
          }
        }
      }

      throw new Error(
        `[MockRouter] No mock route for ${method} ${cleanEndpoint}`
      );
    }

    //Remove query string (?foo=bar)
    stripQuery(endpoint) {
      return endpoint.split('?')[0];
    }
  }

  // Expose globally
  window.MockRouter = MockRouter;

})();
