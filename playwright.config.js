import './test/custom-matchers.js';

const port = process.env.PORT || 8080;
const baseURL = `http://localhost:${port}/`;

export default {
  webServer: {
    command: `PORT=${port} npm start`,
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  use: {
    baseURL
  }
};
