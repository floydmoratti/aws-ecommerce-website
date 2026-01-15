// CART-PAGE.JS - Updated with Mock API Support

class CartPageManager {
  constructor() {
    this.cart = null;
    this.currentEditingProduct = null;
    this.updateModal = null;
    this.config = window.API_CONFIG || { USE_MOCK_API: false, REAL_API_BASE: '/api', MOCK_API_BASE: '/mock' };
  }

  // Get the appropriate API URL
  getApiUrl(endpoint) {
    if (this.config.USE_MOCK_API) {
      // Map endpoints to mock files
      const mockEndpoints = {
        '/cart': '/cart.json'
      };
      
      // Handle parameterized endpoints
      if (endpoint.startsWith('/cart/') && endpoint !== '/cart/add') {
        return `${this.config.MOCK_API_BASE}/cart-delete.json`;
      }
      
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
      // Determine which mock file to use based on method and endpoint
      let mockUrl = url;
      
      if (options.method === 'PUT') {
        mockUrl = `${this.config.MOCK_API_BASE}/cart-update.json`;
      } else if (options.method === 'DELETE') {
        if (url.includes('/cart/') && url !== `${this.config.MOCK_API_BASE}/cart`) {
          mockUrl = `${this.config.MOCK_API_BASE}/cart-delete.json`;
        } else {
          mockUrl = `${this.config.MOCK_API_BASE}/cart-clear.json`;
        }
      }

      const response = await fetch(mockUrl);
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

  // Initialize the cart page
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

  // Setup all event listeners
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

  // Load cart from API
  async loadCart() {
    try {
      this.showLoading();

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

      this.renderCart();
      this.updateCartBadge();
      
    } catch (error) {
      console.error('Error loading cart:', error);
      this.showError('Failed to load cart. Please refresh the page.');
    }
  }

  // Render cart items
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

  // Update cart item weight
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

      const url = this.getApiUrl('/cart');
      const response = await this.mockFetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: productId,
          weightGrams: newWeight
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update cart');
      }

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

  // Remove item from cart
  async removeItem(productId, productName) {
    if (!confirm(`Remove ${productName} from cart?`)) {
      return;
    }

    try {
      const url = this.getApiUrl(`/cart/${productId}`);
      const response = await this.mockFetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove item');
      }

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

  // Confirm clear cart
  confirmClearCart() {
    if (!confirm('Are you sure you want to clear your entire cart? This cannot be undone.')) {
      return;
    }
    this.clearCart();
  }

  // Clear entire cart
  async clearCart() {
    try {
      const url = this.getApiUrl('/cart');
      const response = await this.mockFetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to clear cart');
      }

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

// Initialize cart page manager
const cartPageManager = new CartPageManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  cartPageManager.init();
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

  .cart-item-row {
    transition: background-color 0.2s ease;
  }

  .cart-item-row:hover {
    background-color: #f8f9fa;
  }

  .spinner-border-sm {
    width: 1rem;
    height: 1rem;
    border-width: 0.15em;
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);