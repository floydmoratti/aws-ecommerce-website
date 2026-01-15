// mock-router.js

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
