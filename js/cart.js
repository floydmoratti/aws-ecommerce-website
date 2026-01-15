// CART.JS - Updated with Mock API Support

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