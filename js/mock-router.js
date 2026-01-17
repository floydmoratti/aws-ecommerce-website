// MOCK-ROUTER.JS

(function () {

  class MockRouter {
    constructor(basePath = '/mock') {
      this.basePath = basePath;

      this.routes = [
        { method: 'GET',    path: '/cart',                  file: 'cart.json' },
        { method: 'GET',    path: '/cart/auth',             file: 'cart.json' },
        { method: 'POST',   path: '/cart/items/:id',        file: 'cart-add.json' },
        { method: 'POST',   path: '/cart/items/:id/auth',   file: 'cart-add.json' },
        { method: 'PUT',    path: '/cart/items/:id',        file: 'cart-update.json' },
        { method: 'PUT',    path: '/cart/items/:id/auth',   file: 'cart-update.json' },
        { method: 'DELETE', path: '/cart/items/:id',        file: 'cart-delete.json' },
        { method: 'DELETE', path: '/cart/items/:id/auth',   file: 'cart-delete.json' },
        { method: 'DELETE', path: '/cart',                  file: 'cart-clear.json' },
        { method: 'DELETE', path: '/cart/auth',             file: 'cart-clear.json' },

        { method: 'GET',    path: '/products',              file: 'products.json' },

        { method: 'POST',   path: '/checkout/auth',         file: 'checkout-success.json' },

        { method: 'GET',    path: '/user/profile/auth',     file: 'user-profile.json' },

        { method: 'GET',    path: '/orders/auth',           file: 'orders.json' },
      ];
    }

    //Resolve a mock file based on HTTP method and endpoint
    resolve(method, endpoint) {
      const cleanEndpoint = this.stripQuery(endpoint);

      // Exact matches FIRST (no :)
      for (const route of this.routes) {
        if (route.method !== method) continue;
        if (!route.path.includes(':') && route.path === cleanEndpoint) {
          return `${this.basePath}/${route.file}`;
        }
      }

      // Wildcard matches SECOND
      for (const route of this.routes) {
        if (route.method !== method) continue;
        if (!route.path.includes(':')) continue;

        const routeParts = route.path.split('/');
        const endpointParts = cleanEndpoint.split('/');

        if (routeParts.length !== endpointParts.length) continue;

        let match = true;

        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) continue; // wildcard
          if (routeParts[i] !== endpointParts[i]) {
            match = false;
            break;
          }
        }

  if (match) {
    return `${this.basePath}/${route.file}`;
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
