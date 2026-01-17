// CHECKOUT.JS

class CheckoutManager {
  constructor() {
    this.cart = null;
    this.currentStep = 1;
    this.formData = {
      shipping: {},
      payment: {}
    };
    this.userProfile = null;
    this.successModal = null;

    this.config = window.API_CONFIG;
    this.mockRouter = this.config.USE_MOCK_API
      ? new window.MockRouter(this.config.MOCK_API_BASE)
      : null;

    // Shipping cost and tax rate
    this.SHIPPING_COST = 2.99;
    this.TAX_RATE = 0.08; // 8%
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

    // Initialize success modal
    const modalElement = document.getElementById('successModal');
    this.successModal = new bootstrap.Modal(modalElement);

    // Setup event listeners
    this.setupEventListeners();

    // Load cart and user profile
    await Promise.all([
      this.loadCart(),
      this.loadUserProfile()
    ]);

    console.log(`Checkout initialized in ${this.config.USE_MOCK_API ? 'MOCK' : 'REAL'} API mode`);
  }

  // ----------------------
  // Authentication Check
  // ----------------------

  showAuthRequired() {
    document.getElementById('loadingState').style.display = 'none';
    const authRequired = document.getElementById('authRequired');
    authRequired.style.display = 'block';

    // Setup sign-in link
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
  // Load Cart
  // ----------------------

  async loadCart() {
    try {

      const response = await this.apiFetch('GET', this.isAuthenticated() ? '/cart/auth' : '/cart');

      if (!response.ok) throw new Error('Failed to fetch cart');

      const data = await response.json();
      this.cart = data.cart;

      if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
        this.showEmptyCart();
        return;
      }

      this.renderOrderSummary();
      this.showCheckoutContent();

    } catch (error) {
      console.error('Error loading cart:', error);
      this.showError('Failed to load cart');
    }
  }

  // ----------------------
  // Load User Profile (from Cognito)
  // ----------------------

  async loadUserProfile() {
    try {
      // In production, this would call Cognito GetUser API
      // For mock mode, we'll use a mock endpoint
      const response = await this.apiFetch('GET', '/user/profile/auth');
      
      if (response.ok) {
        const data = await response.json();
        this.userProfile = data.user;
        this.autoFillShippingForm();
      }
    } catch (error) {
      console.warn('Could not load user profile:', error);
      // Continue without auto-fill
    }
  }

  // ----------------------
  // Auto-fill Shipping Form
  // ----------------------

  autoFillShippingForm() {
    if (!this.userProfile) return;

    const fields = {
      firstName: this.userProfile.firstName || this.userProfile.given_name,
      lastName: this.userProfile.lastName || this.userProfile.family_name,
      email: this.userProfile.email,
      phone: this.userProfile.phone || this.userProfile.phone_number,
      address: this.userProfile.address?.street || this.userProfile.address,
      city: this.userProfile.address?.city,
      state: this.userProfile.address?.state,
      zip: this.userProfile.address?.zip || this.userProfile.address?.postal_code
    };

    // Fill form fields if they exist
    Object.keys(fields).forEach(key => {
      const element = document.getElementById(key);
      if (element && fields[key]) {
        element.value = fields[key];
      }
    });
  }

  // ----------------------
  // Setup Event Listeners
  // ----------------------

  setupEventListeners() {
    // Shipping form submit
    const shippingForm = document.getElementById('shippingFormElement');
    if (shippingForm) {
      shippingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitShippingForm();
      });
    }

    // Payment form submit
    const paymentForm = document.getElementById('paymentFormElement');
    if (paymentForm) {
      paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitPaymentForm();
      });
    }

    // Card number formatting
    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) {
      cardNumber.addEventListener('input', (e) => {
        e.target.value = this.formatCardNumber(e.target.value);
      });
    }

    // Expiry date formatting
    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) {
      cardExpiry.addEventListener('input', (e) => {
        e.target.value = this.formatExpiry(e.target.value);
      });
    }

    // CVV numeric only
    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) {
      cardCvv.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
    }

    // Navigation buttons
    document.getElementById('backToShipping')?.addEventListener('click', () => {
      this.goToStep(1);
    });

    document.getElementById('backToPayment')?.addEventListener('click', () => {
      this.goToStep(2);
    });

    // Place order button
    document.getElementById('placeOrderBtn')?.addEventListener('click', () => {
      this.placeOrder();
    });
  }

  // ----------------------
  // Form Formatting Helpers
  // ----------------------

  formatCardNumber(value) {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substr(0, 19);
  }

  formatExpiry(value) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substr(0, 2) + '/' + cleaned.substr(2, 2);
    }
    return cleaned;
  }

  // ----------------------
  // Step Navigation
  // ----------------------

  goToStep(step) {
    // Hide all steps
    document.getElementById('shippingForm').style.display = 'none';
    document.getElementById('paymentForm').style.display = 'none';
    document.getElementById('reviewForm').style.display = 'none';

    // Remove active class from all steps
    document.getElementById('step1').classList.remove('active', 'completed');
    document.getElementById('step2').classList.remove('active', 'completed');
    document.getElementById('step3').classList.remove('active', 'completed');

    // Show current step
    this.currentStep = step;
    
    if (step === 1) {
      document.getElementById('shippingForm').style.display = 'block';
      document.getElementById('step1').classList.add('active');
    } else if (step === 2) {
      document.getElementById('paymentForm').style.display = 'block';
      document.getElementById('step1').classList.add('completed');
      document.getElementById('step2').classList.add('active');
    } else if (step === 3) {
      document.getElementById('reviewForm').style.display = 'block';
      document.getElementById('step1').classList.add('completed');
      document.getElementById('step2').classList.add('completed');
      document.getElementById('step3').classList.add('active');
      this.renderReview();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----------------------
  // Submit Shipping Form
  // ----------------------

  submitShippingForm() {
    const form = document.getElementById('shippingFormElement');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Collect shipping data
    this.formData.shipping = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value.trim(),
      zip: document.getElementById('zip').value.trim()
    };

    // Auto-fill card name with full name
    const cardName = document.getElementById('cardName');
    if (cardName) {
      cardName.value = `${this.formData.shipping.firstName} ${this.formData.shipping.lastName}`;
    }

    this.goToStep(2);
  }

  // ----------------------
  // Submit Payment Form
  // ----------------------

  submitPaymentForm() {
    const form = document.getElementById('paymentFormElement');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Validate card number
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      alert('Please enter a valid card number');
      return;
    }

    // Validate expiry
    const expiry = document.getElementById('cardExpiry').value;
    if (!this.validateExpiry(expiry)) {
      alert('Please enter a valid expiry date (MM/YY)');
      return;
    }

    // Collect payment data (masked)
    this.formData.payment = {
      cardName: document.getElementById('cardName').value.trim(),
      cardNumber: cardNumber,
      cardExpiry: expiry,
      cardCvv: document.getElementById('cardCvv').value.trim(),
      // Store masked version for display
      maskedCard: '****' + cardNumber.slice(-4)
    };

    this.goToStep(3);
  }

  validateExpiry(expiry) {
    const match = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;

    const month = parseInt(match[1]);
    const year = parseInt('20' + match[2]);
    
    if (month < 1 || month > 12) return false;

    const now = new Date();
    const expiryDate = new Date(year, month - 1);
    
    return expiryDate > now;
  }

  // ----------------------
  // Render Review Section
  // ----------------------

  renderReview() {
    // Shipping info
    const shippingHtml = `
      <div>
        <strong>${this.formData.shipping.firstName} ${this.formData.shipping.lastName}</strong><br>
        ${this.formData.shipping.address}<br>
        ${this.formData.shipping.city}, ${this.formData.shipping.state} ${this.formData.shipping.zip}<br>
        <strong>Email:</strong> ${this.formData.shipping.email}<br>
        <strong>Phone:</strong> ${this.formData.shipping.phone}
      </div>
    `;
    document.getElementById('reviewShipping').innerHTML = shippingHtml;

    // Payment info
    const paymentHtml = `
      <div>
        <i class="bi bi-credit-card me-2"></i>
        <strong>Card ending in ${this.formData.payment.maskedCard}</strong><br>
        Expires: ${this.formData.payment.cardExpiry}
      </div>
    `;
    document.getElementById('reviewPayment').innerHTML = paymentHtml;
  }

  // ----------------------
  // Place Order
  // ----------------------

  async placeOrder() {
    // Check terms agreement
    const termsCheck = document.getElementById('termsCheck');
    if (!termsCheck.checked) {
      alert('Please agree to the Terms & Conditions');
      return;
    }

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

    try {
      // Calculate totals
      const subtotal = this.cart.subtotal;
      const tax = subtotal * this.TAX_RATE;
      const total = subtotal + this.SHIPPING_COST + tax;

      // Prepare order data
      const orderData = {
        items: this.cart.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          weightGrams: item.weightGrams,
          pricePerUnit: item.pricePerUnit,
          quantity: item.weightGrams, // Store weight as quantity
          totalPrice: item.totalPrice
        })),
        shipping: this.formData.shipping,
        payment: {
          cardName: this.formData.payment.cardName,
          cardLast4: this.formData.payment.cardNumber.slice(-4),
          cardExpiry: this.formData.payment.cardExpiry
          // Never send full card number or CVV to backend in production
        },
        pricing: {
          subtotal: subtotal,
          shipping: this.SHIPPING_COST,
          tax: tax,
          total: total
        }
      };

      // Submit order
      const response = await this.apiFetch('POST', '/checkout/auth', {
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment failed');
      }

      const result = await response.json();

      // Show success modal
      document.getElementById('orderIdDisplay').textContent = result.orderId;
      this.successModal.show();

      // Clear cart badge
      const badge = document.querySelector('.badge.bg-dark');
      if (badge) badge.textContent = '0';

    } catch (error) {
      console.error('Error placing order:', error);
      alert(`Order failed: ${error.message}`);
      
      // Reset button
      placeOrderBtn.disabled = false;
      placeOrderBtn.innerHTML = '<i class="bi bi-lock-fill me-2"></i>Place Order';
    }
  }

  // ----------------------
  // Render Order Summary
  // ----------------------

  renderOrderSummary() {
    const itemsList = document.getElementById('orderItemsList');
    itemsList.innerHTML = '';

    this.cart.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'd-flex justify-content-between align-items-center mb-2';
      
      const weightDisplay = item.weightGrams >= 1000 
        ? `${(item.weightGrams / 1000).toFixed(1)}kg`
        : `${item.weightGrams}g`;

      itemDiv.innerHTML = `
        <div>
          <strong>${item.productName}</strong><br>
          <small class="text-muted">${weightDisplay} @ $${item.pricePerUnit.toFixed(2)}/100g</small>
        </div>
        <div class="text-end">
          <strong>$${item.totalPrice.toFixed(2)}</strong>
        </div>
      `;
      itemsList.appendChild(itemDiv);
    });

    // Calculate totals
    const subtotal = this.cart.subtotal;
    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + this.SHIPPING_COST + tax;

    document.getElementById('orderSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('orderShipping').textContent = `$${this.SHIPPING_COST.toFixed(2)}`;
    document.getElementById('orderTax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('orderTotal').textContent = `$${total.toFixed(2)}`;

    // Update cart badge
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = this.cart.itemCount || 0;
    }
  }

  // ----------------------
  // UI Helpers
  // ----------------------

  showEmptyCart() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyCartMessage').style.display = 'block';
  }

  showCheckoutContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('checkoutContent').style.display = 'block';
  }

  showError(message) {
    document.getElementById('loadingState').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-circle me-2"></i>
        ${message}
      </div>
    `;
  }
}

function isAuthenticated() {
  if (window.API_CONFIG?.DEV_MOCK_AUTH === true) {
    return true;
  }
  return !!sessionStorage.getItem('id_token');
}

// Initialize checkout manager
const checkoutManager = new CheckoutManager();

document.addEventListener('DOMContentLoaded', () => {
  checkoutManager.init();
});