import { defineConfig, devices } from '@playwright/test';

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3101);
const MOCK_API_PORT = Number(process.env.MOCK_API_PORT ?? 4010);
const isCI = Boolean(process.env.CI);

// No CI e em `npm run test:e2e:prod` testa o build de produção (o build roda antes);
// em `npm run test:e2e` usa o modo dev. E2E_SERVER=start também força o build de produção.
const useProductionServer =
  isCI || process.env.npm_lifecycle_event === 'test:e2e:prod' || process.env.E2E_SERVER === 'start';

// Valores fictícios: o app aponta para a API simulada e nunca para a API real.
const appEnv = {
  BASE_URL: `http://localhost:${MOCK_API_PORT}`,
  FIU_FIU_API_BASE_URL: `http://localhost:${MOCK_API_PORT}`,
  DATABASE_URL: 'postgresql://e2e:e2e@localhost:5432/e2e',
  MOCK_API_PORT: String(MOCK_API_PORT),
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: './tests/e2e',
  // Os testes compartilham uma API simulada com estado, então rodam em sequência.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Permite usar um Chrome já instalado em vez do baixado por `npx playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: 'node tests/e2e/mock-api.mjs',
      url: `http://localhost:${MOCK_API_PORT}/__requests`,
      env: appEnv,
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
    {
      command: useProductionServer
        ? `npx next start -p ${APP_PORT}`
        : `npx next dev --webpack -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      env: appEnv,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
