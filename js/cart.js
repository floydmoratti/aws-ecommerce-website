// CART.JS - Updated with Mock API Support

class CartManager {
  constructor() {
    this.cart = null;
    this.isLoading = false;
    this.config = window.API_CONFIG || { USE_MOCK_API: false, REAL_API_BASE: '/api', MOCK_API_BASE: '/mock' };
  }

  // Get the appropriate API URL
  getApiUrl(endpoint) {
    if (this.config.USE_MOCK_API) {
      // Map endpoints to mock files
      const mockEndpoints = {
        '/cart': '/cart.json',
        '/cart/add': '/cart-add.json',
        '/cart/update': '/cart-update.json',
        '/cart/delete': '/cart-delete.json',
        '/cart/clear': '/cart-clear.json'
      };
      
      const mockFile = mockEndpoints[endpoint] || `${endpoint}.json`;
      return `${this.config.MOCK_API_BASE}${mockFile}`;
    }
    return `${this.config.REAL_API_BASE}${endpoint}`;
  }

  // Mock API fetch wrapper
  async mockFetch(url, options = {}) {
    if (!this.config.USE_MOCK_API) {
      // Use real fetch for real API
      return fetch(url, options);
    }

    // Simulate network delay for mock API
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mock API error: ${response.status}`);
      }
      const data = await response.json();
      
      // Return a mock Response object
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

  // Get cart from API
  async getCart() {
    try {
      const url = this.getApiUrl('/cart');
      const response = await this.mockFetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }

      const data = await response.json();
      this.cart = data.cart;
      this.updateCartBadge();
      return this.cart;
    } catch (error) {
      console.error('Error fetching cart:', error);
      return null;
    }
  }

  // Add item to cart
  async addToCart(button, productId, weightGrams) {
  if (this.isLoading) return;

  this.isLoading = true;
  const originalText = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Adding...';

    const url = this.getApiUrl('/cart/add');
    const response = await this.mockFetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, weightGrams })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add to cart');
    }

    const data = await response.json();
    this.cart = data.cart;

    button.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Added!';
    button.classList.add('btn-success');
    button.classList.remove('btn-outline-dark');

    this.updateCartBadge();
    this.showNotification('Item added to cart!', 'success');

    setTimeout(() => {
      button.innerHTML = originalText;
      button.classList.remove('btn-success');
      button.classList.add('btn-outline-dark');
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
      button.classList.remove('btn-danger');
      button.classList.add('btn-outline-dark');
      button.disabled = false;
    }, 3000);

    throw error;
  } finally {
    this.isLoading = false;
  }
}

  // Update cart badge in navigation
  updateCartBadge() {
    const badge = document.querySelector('.badge.bg-dark');
    if (badge && this.cart) {
      const itemCount = this.cart.itemCount || 0;
      badge.textContent = itemCount;
      
      // Add animation
      badge.classList.add('cart-badge-update');
      setTimeout(() => {
        badge.classList.remove('cart-badge-update');
      }, 300);
    }
  }

  // Show toast notification
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
}

// Initialize cart manager
const cartManager = new CartManager();

// Setup add to cart button
function setupAddToCartButton() {
  const cartButton = document.querySelector('.add-to-cart-btn');
  const weightSelect = document.getElementById('weightSelect');
  const productDiv = document.querySelector('.product');

  if (!cartButton || !weightSelect || !productDiv) {
    console.error('Required elements not found');
    return;
  }

  const productId = productDiv.dataset.id;

  cartButton.addEventListener('click', async (e) => {
  e.preventDefault();

  if (cartButton.disabled || cartButton.dataset.soldOut === "true") {
    return;
  }

  const selectedWeight = parseInt(weightSelect.value);

  try {
    await cartManager.addToCart(cartButton, productId, selectedWeight);
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

// Setup buy now button
function setupBuyNowButtons() {
  const buyButtons = document.querySelectorAll('.buy-btn');

  buyButtons.forEach(button => {
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


// Disable buttons when stock = 0
async function updateButtons() {
  const products = document.querySelectorAll('.product');
  if (!products.length) return;

  const config = window.API_CONFIG || { USE_MOCK_API: false };
  const apiUrl = config.USE_MOCK_API
    ? '/mock/products.json'
    : '/api/products';

  try {
    const response = await fetch(apiUrl);
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

// CSS styles for notifications
const styles = `
  .cart-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    opacity: 0;
    transform: translateX(400px);
    transition: all 0.3s ease;
  }

  .cart-notification.show {
    opacity: 1;
    transform: translateX(0);
  }

  .cart-notification-success {
    border-left: 4px solid #28a745;
  }

  .cart-notification-error {
    border-left: 4px solid #dc3545;
  }

  .cart-notification-content {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
  }

  .cart-notification-success .bi {
    color: #28a745;
  }

  .cart-notification-error .bi {
    color: #dc3545;
  }

  .cart-badge-update {
    animation: badgePulse 0.3s ease;
  }

  @keyframes badgePulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.3);
    }
    100% {
      transform: scale(1);
    }
  }

  .add-to-cart-btn {
    transition: all 0.2s ease;
  }

  .add-to-cart-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);