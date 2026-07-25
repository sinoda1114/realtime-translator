import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4310",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next build && pnpm exec next start -p 4310",
    url: "http://localhost:4310",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_ENABLE_MOCK_TRANSLATION: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          args: ["--autoplay-policy=no-user-gesture-required"],
        },
      },
    },
  ],
});
