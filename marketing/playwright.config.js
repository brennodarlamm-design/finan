import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  use: { baseURL: "http://127.0.0.1:5175", headless: true },
  webServer: {
    command: "npm run dev:landing -- --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
