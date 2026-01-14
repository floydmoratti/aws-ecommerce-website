// Cart functionality for product pages
const API_BASE_URL = '/api';
const API_MOCK_URL = "/products/mock/products.json";

class CartManager {
  constructor() {
    this.cart = null;
    this.isLoading = false;
  }

  // Get cart from API
  async getCart() {
    try {
      const response = await fetch(`${API_BASE_URL}/cart`, {
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
  async addToCart(productId, weightGrams) {
    if (this.isLoading) return;
    
    this.isLoading = true;
    const button = document.querySelector('.add-to-cart-btn');
    const originalText = button.innerHTML;
    
    try {
      // Show loading state
      button.disabled = true;
      button.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Adding...';

      const response = await fetch(`${API_BASE_URL}/cart/add`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: productId,
          weightGrams: weightGrams
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add to cart');
      }

      const data = await response.json();
      this.cart = data.cart;
      
      // Show success feedback
      button.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Added!';
      button.classList.add('btn-success');
      button.classList.remove('btn-outline-dark');
      
      // Update cart badge
      this.updateCartBadge();
      
      // Show notification
      this.showNotification('Item added to cart!', 'success');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('btn-success');
        button.classList.add('btn-outline-dark');
        button.disabled = false;
      }, 2000);
      
      return data;
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      
      // Show error feedback
      button.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i> Error';
      button.classList.add('btn-danger');
      button.classList.remove('btn-outline-dark');
      
      // Show error notification
      this.showNotification(error.message, 'error');
      
      // Reset button after 3 seconds
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
  const button = document.querySelector('.add-to-cart-btn');
  const weightSelect = document.getElementById('weightSelect');
  const productDiv = document.querySelector('.product');

  if (!button || !weightSelect || !productDiv) {
    console.error('Required elements not found');
    return;
  }

  const productId = productDiv.dataset.id;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (button.disabled) return;

    const selectedWeight = parseInt(weightSelect.value);
    
    try {
      await cartManager.addToCart(productId, selectedWeight);
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

// Disable buttons when stock = 0
async function updateButtons() {
  const products = document.querySelectorAll('.product');
  if (!products.length) return;

  try {
    const response = await fetch(API_MOCK_URL);
    if (!response.ok) throw new Error('Mock API error');

    const data = await response.json();

    products.forEach(product => {
      const productId = product.dataset.id;
      const button = product.querySelector('.add-to-cart-btn');

      if (data[productId] && data[productId].quantity === 0) {
        button.textContent = "Sold Out";
        button.disabled = true;
        button.classList.add('disabled');
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// Load cart on page load
async function initializeCart() {
  try {
    await cartManager.getCart();
  } catch (error) {
    console.error('Failed to initialize cart:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeCart();
  setupAddToCartButton();
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