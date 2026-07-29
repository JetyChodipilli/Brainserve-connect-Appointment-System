import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-backend",
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_BASE_URL: "http://backend.invalid/api/v1" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
