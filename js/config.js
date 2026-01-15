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