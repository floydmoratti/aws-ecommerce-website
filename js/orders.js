// ORDERS.JS

class OrdersManager {
  constructor() {
    this.orders = [];
    this.filteredOrders = [];
    this.currentFilter = 'all';
    this.detailsModal = null;
    this.trackModal = null;
    this.selectedOrder = null;

    this.config = window.API_CONFIG;
    this.mockRouter = this.config.USE_MOCK_API
      ? new window.MockRouter(this.config.MOCK_API_BASE)
      : null;
  }

  isAuthenticated() {
    if (this.config?.DEV_MOCK_AUTH === true) {
      return true;
    }
    return !!sessionStorage.getItem('id_token');
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
        'Authorization': `Bearer ${sessionStorage.getItem('id_token') || ''}`,
        ...(options.headers || {})
      },
      body: options.body
    });
  }

  // ----------------------
  // Initialize
  // ----------------------

  async init() {
    // Check authentication
    if (!this.isAuthenticated()) {
      this.showAuthRequired();
      return;
    }

    // Initialize modals
    this.detailsModal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    this.trackModal = new bootstrap.Modal(document.getElementById('trackOrderModal'));

    // Setup event listeners
    this.setupEventListeners();

    // Load orders
    await this.loadOrders();

    console.log(`Orders page initialized in ${this.config.USE_MOCK_API ? 'MOCK' : 'REAL'} API mode`);
  }

  // ----------------------
  // Authentication Check
  // ----------------------

  showAuthRequired() {
    document.getElementById('loadingState').style.display = 'none';
    const authRequired = document.getElementById('authRequired');
    authRequired.style.display = 'block';

    const signInLink = document.getElementById('authSignInLink');
    if (signInLink && window.APP_CONFIG) {
      const params = new URLSearchParams({
        client_id: window.APP_CONFIG.CLIENT_ID,
        response_type: 'code',
        scope: 'email openid profile',
        redirect_uri: window.APP_CONFIG.REDIRECT_URI
      });
      signInLink.href = `${window.APP_CONFIG.COGNITO_DOMAIN}/login?${params.toString()}`;
    }
  }

  // ----------------------
  // Setup Event Listeners
  // ----------------------

  setupEventListeners() {
    // Filter dropdown
    const filterSelect = document.getElementById('orderFilter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.filterOrders();
      });
    }

    // Reorder button
    const reorderBtn = document.getElementById('reorderBtn');
    if (reorderBtn) {
      reorderBtn.addEventListener('click', () => {
        this.reorderItems();
      });
    }
  }

  // ----------------------
  // Load Orders
  // ----------------------

  async loadOrders() {
    try {
      this.showLoading();

      const response = await this.apiFetch('GET', '/orders/auth');
      
      if (!response.ok) throw new Error('Failed to fetch orders');

      const data = await response.json();
      this.orders = data.orders || [];

      if (this.orders.length === 0) {
        this.showEmptyState();
      } else {
        this.filteredOrders = [...this.orders];
        this.renderOrders();
        this.showOrdersContent();
      }

    } catch (error) {
      console.error('Error loading orders:', error);
      this.showError('Failed to load orders. Please refresh the page.');
    }
  }

  // ----------------------
  // Filter Orders
  // ----------------------

  filterOrders() {
    if (this.currentFilter === 'all') {
      this.filteredOrders = [...this.orders];
    } else {
      this.filteredOrders = this.orders.filter(order => order.status === this.currentFilter);
    }

    if (this.filteredOrders.length === 0) {
      this.showEmptyState(true);
    } else {
      this.renderOrders();
    }
  }

  // ----------------------
  // Render Orders
  // ----------------------

  renderOrders() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '';

    // Sort by date (newest first)
    const sortedOrders = [...this.filteredOrders].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sortedOrders.forEach(order => {
      const orderCard = this.createOrderCard(order);
      ordersList.appendChild(orderCard);
    });

    document.getElementById('emptyOrders').style.display = 'none';
  }

  // ----------------------
  // Create Order Card
  // ----------------------

  createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';

    // Format date
    const orderDate = new Date(order.createdAt);
    const formattedDate = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Count items
    const itemCount = Object.keys(order.items || {}).length;

    // Status badge
    const statusClass = `status-${order.status}`;
    const statusText = this.formatStatus(order.status);

    card.innerHTML = `
      <div class="order-header">
        <div class="row align-items-center">
          <div class="col-md-3">
            <small class="text-muted">Order Number</small><br>
            <strong>${order.orderId}</strong>
          </div>
          <div class="col-md-3">
            <small class="text-muted">Date Placed</small><br>
            <strong>${formattedDate}</strong>
          </div>
          <div class="col-md-2">
            <small class="text-muted">Total</small><br>
            <strong>$${order.totalAmount.toFixed(2)}</strong>
          </div>
          <div class="col-md-2">
            <small class="text-muted">Status</small><br>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="col-md-2 text-end">
            <button class="btn btn-sm btn-outline-primary view-details-btn" data-order-id="${order.orderId}">
              View Details
            </button>
          </div>
        </div>
      </div>
      <div class="order-body">
        <div class="row">
          <div class="col-md-8">
            <h6 class="mb-3">${itemCount} Item${itemCount !== 1 ? 's' : ''}</h6>
            <div class="order-items-preview" id="items-${order.orderId}">
              <!-- Items preview will be inserted here -->
            </div>
          </div>
          <div class="col-md-4">
            <div class="d-grid gap-2">
              ${order.status === 'SHIPPED' ? `
                <button class="btn btn-outline-secondary btn-sm track-order-btn" data-order-id="${order.orderId}">
                  <i class="bi bi-geo-alt me-2"></i>Track Order
                </button>
              ` : ''}
              <button class="btn btn-outline-primary btn-sm reorder-items-btn" data-order-id="${order.orderId}">
                <i class="bi bi-arrow-repeat me-2"></i>Buy Again
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="order-footer">
        <div class="row align-items-center">
          <div class="col-md-8">
            <small class="text-muted">
              <i class="bi bi-geo-alt me-1"></i>
              Shipping to: ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}
            </small>
          </div>
          <div class="col-md-4 text-end">
            <small class="text-muted">Payment: •••• ${order.paymentInfo?.cardLast4 || '****'}</small>
          </div>
        </div>
      </div>
    `;

    // Add items preview
    this.renderItemsPreview(order);

    // Add event listeners after card is created
    setTimeout(() => {
      const viewBtn = card.querySelector('.view-details-btn');
      viewBtn?.addEventListener('click', () => this.showOrderDetails(order));

      const trackBtn = card.querySelector('.track-order-btn');
      trackBtn?.addEventListener('click', () => this.showTrackOrder(order));

      const reorderBtn = card.querySelector('.reorder-items-btn');
      reorderBtn?.addEventListener('click', () => this.reorderFromCard(order));
    }, 0);

    return card;
  }

  // ----------------------
  // Render Items Preview
  // ----------------------

  renderItemsPreview(order) {
    setTimeout(() => {
      const container = document.getElementById(`items-${order.orderId}`);
      if (!container) return;

      const items = Object.entries(order.items || {});
      const previewCount = Math.min(items.length, 3);

      items.slice(0, previewCount).forEach(([productId, item]) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item';
        
        const weightDisplay = item.quantity >= 1000 
          ? `${(item.quantity / 1000).toFixed(1)}kg`
          : `${item.quantity}g`;

        itemDiv.innerHTML = `
          <div>
            <div class="order-item-name">${item.productName}</div>
            <div class="order-item-details">${weightDisplay}</div>
          </div>
          <div class="order-item-price">
            <strong>$${item.totalPrice.toFixed(2)}</strong>
          </div>
        `;
        container.appendChild(itemDiv);
      });

      // Show "and X more" if there are more items
      if (items.length > previewCount) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'text-muted small mt-2';
        moreDiv.innerHTML = `<i>and ${items.length - previewCount} more item${items.length - previewCount !== 1 ? 's' : ''}...</i>`;
        container.appendChild(moreDiv);
      }
    }, 0);
  }

  // ----------------------
  // Show Order Details Modal
  // ----------------------

  showOrderDetails(order) {
    this.selectedOrder = order;
    
    const orderDate = new Date(order.createdAt);
    const formattedDate = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsHtml = '';
    Object.entries(order.items || {}).forEach(([productId, item]) => {
      const weightDisplay = item.quantity >= 1000 
        ? `${(item.quantity / 1000).toFixed(1)}kg`
        : `${item.quantity}g`;

      itemsHtml += `
        <div class="order-item">
          <div>
            <div class="order-item-name">${item.productName}</div>
            <div class="order-item-details">
              ${weightDisplay} @ $${item.pricePerUnit.toFixed(2)}/100g
            </div>
          </div>
          <div class="order-item-price">
            <strong>$${item.totalPrice.toFixed(2)}</strong>
          </div>
        </div>
      `;
    });

    const detailsHtml = `
      <div class="mb-4">
        <h6 class="text-muted mb-2">Order Information</h6>
        <div class="row">
          <div class="col-6">
            <strong>Order ID:</strong><br>
            <span class="text-muted">${order.orderId}</span>
          </div>
          <div class="col-6">
            <strong>Date:</strong><br>
            <span class="text-muted">${formattedDate}</span>
          </div>
        </div>
        <div class="row mt-3">
          <div class="col-6">
            <strong>Status:</strong><br>
            <span class="status-badge status-${order.status}">${this.formatStatus(order.status)}</span>
          </div>
          <div class="col-6">
            <strong>Payment Ref:</strong><br>
            <span class="text-muted">${order.paymentRef || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div class="mb-4">
        <h6 class="text-muted mb-2">Items</h6>
        <div class="border rounded p-3">
          ${itemsHtml}
        </div>
      </div>

      <div class="mb-4">
        <h6 class="text-muted mb-2">Shipping Address</h6>
        <div class="border rounded p-3">
          <strong>${order.shippingAddress.firstName} ${order.shippingAddress.lastName}</strong><br>
          ${order.shippingAddress.address}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}<br>
          <div class="mt-2">
            <i class="bi bi-envelope me-2"></i>${order.shippingAddress.email}<br>
            <i class="bi bi-telephone me-2"></i>${order.shippingAddress.phone}
          </div>
        </div>
      </div>

      <div class="mb-4">
        <h6 class="text-muted mb-2">Payment Information</h6>
        <div class="border rounded p-3">
          <i class="bi bi-credit-card me-2"></i>
          Card ending in ${order.paymentInfo?.cardLast4 || '****'}<br>
          <small class="text-muted">Payment Provider: ${order.paymentProvider}</small>
        </div>
      </div>

      <div>
        <h6 class="text-muted mb-2">Order Summary</h6>
        <div class="border rounded p-3">
          <div class="d-flex justify-content-between mb-2">
            <span>Subtotal:</span>
            <strong>$${order.subtotal.toFixed(2)}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Shipping:</span>
            <strong>$${order.shipping.toFixed(2)}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span>Tax:</span>
            <strong>$${order.tax.toFixed(2)}</strong>
          </div>
          <hr>
          <div class="d-flex justify-content-between">
            <span class="h6 mb-0">Total:</span>
            <strong class="h6 mb-0 text-success">$${order.totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    `;

    document.getElementById('orderDetailsBody').innerHTML = detailsHtml;
    this.detailsModal.show();
  }

  // ----------------------
  // Show Track Order Modal
  // ----------------------

  showTrackOrder(order) {
    const orderDate = new Date(order.createdAt);
    const formattedDate = orderDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    document.getElementById('trackOrderPlaced').textContent = formattedDate;

    // Update tracking steps based on order status
    const processingStep = document.getElementById('trackProcessing');
    const shippedStep = document.getElementById('trackShipped');
    const deliveredStep = document.getElementById('trackDelivered');

    // Reset all steps
    processingStep.classList.remove('completed', 'active');
    shippedStep.classList.remove('completed', 'active');
    deliveredStep.classList.remove('completed', 'active');

    // Update based on status
    if (order.status === 'PAID') {
      processingStep.classList.add('active');
    } else if (order.status === 'SHIPPED') {
      processingStep.classList.add('completed');
      shippedStep.classList.add('active');
    } else if (order.status === 'DELIVERED') {
      processingStep.classList.add('completed');
      shippedStep.classList.add('completed');
      deliveredStep.classList.add('completed');
    }

    this.trackModal.show();
  }

  // ----------------------
  // Reorder Items
  // ----------------------

  async reorderItems() {
    if (!this.selectedOrder) return;
    await this.reorderFromCard(this.selectedOrder);
  }

  async reorderFromCard(order) {
    try {
      // Get items from order
      const items = Object.entries(order.items || {});

      if (items.length === 0) {
        this.showNotification('No items to reorder', 'warning');
        return;
      }

      // Add each item to cart
      let successCount = 0;
      for (const [productId, item] of items) {
        try {
          const response = await this.apiFetch('POST', this.isAuthenticated() ? `/cart/items/${productId}/auth` : `/cart/items/${productId}`, {
            body: JSON.stringify({
              productId: productId,
              weightGrams: item.quantity
            })
          });

          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to add ${item.productName}:`, error);
        }
      }

      if (successCount > 0) {
        this.showNotification(`Added ${successCount} item${successCount !== 1 ? 's' : ''} to cart!`, 'success');
        
        // Update cart badge
        this.updateCartBadge();

        // Close modal if open
        if (this.detailsModal) {
          this.detailsModal.hide();
        }

        // Optional: redirect to cart after short delay
        setTimeout(() => {
          if (confirm('Items added to cart. Go to cart now?')) {
            window.location.href = '/cart.html';
          }
        }, 1000);
      } else {
        this.showNotification('Failed to add items to cart', 'error');
      }

    } catch (error) {
      console.error('Reorder error:', error);
      this.showNotification('Failed to reorder items', 'error');
    }
  }

  // ----------------------
  // Update Cart Badge
  // ----------------------

  async updateCartBadge() {
    try {
      const response = await this.apiFetch('GET', this.isAuthenticated() ? '/cart/auth' : '/cart');
      if (response.ok) {
        const data = await response.json();
        const badge = document.getElementById('cartBadge');
        if (badge && data.cart) {
          badge.textContent = data.cart.itemCount || 0;
        }
      }
    } catch (error) {
      console.warn('Could not update cart badge:', error);
    }
  }

  // ----------------------
  // Helpers
  // ----------------------

  formatStatus(status) {
    const statusMap = {
      'PAID': 'Paid',
      'PENDING_PAYMENT': 'Pending',
      'SHIPPED': 'Shipped',
      'FAILED': 'Failed',
      'DELIVERED': 'Delivered'
    };
    return statusMap[status] || status;
  }

  showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('ordersContent').style.display = 'none';
  }

  showOrdersContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('ordersContent').style.display = 'block';
  }

  showEmptyState(filtered = false) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('ordersContent').style.display = 'block';
    const emptyDiv = document.getElementById('emptyOrders');
    emptyDiv.style.display = 'block';

    if (filtered) {
      emptyDiv.querySelector('h4').textContent = 'No orders found';
      emptyDiv.querySelector('p').textContent = 'Try changing the filter to see more orders.';
    }
  }

  showError(message) {
    document.getElementById('loadingState').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        ${message}
      </div>
    `;
  }

  showNotification(message, type = 'success') {
    const existing = document.querySelector('.order-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `order-notification order-notification-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#d1e7dd' : type === 'error' ? '#f8d7da' : '#fff3cd'};
      color: ${type === 'success' ? '#0a3622' : type === 'error' ? '#58151c' : '#664d03'};
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
    `;
    notification.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi bi-${type === 'success' ? 'check-circle-fill' : type === 'error' ? 'exclamation-circle-fill' : 'info-circle-fill'} me-2"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

function isAuthenticated() {
  if (window.CONFIG?.DEV_MOCK_AUTH === true) {
    return true;
  }
  return !!sessionStorage.getItem("id_token");
}

// Initialize orders manager
const ordersManager = new OrdersManager();

document.addEventListener('DOMContentLoaded', () => {
  ordersManager.init();
});