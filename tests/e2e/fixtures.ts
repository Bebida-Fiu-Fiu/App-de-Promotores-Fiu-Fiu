import { test as base, expect, type Page } from '@playwright/test';

export const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4010}`;

// Contas fictícias da API simulada (tests/e2e/mock-api.mjs).
export const ACCOUNTS = {
  promotor: { email: 'ana@teste.local', password: 'senha-teste' },
  comercial: { email: 'carlos@teste.local', password: 'senha-teste' },
} as const;

type MockControl = { visitsStatus?: number; agendaPatchRouteExists?: boolean };

export type MockRequest = { method: string; path: string; search: string; body: unknown };

async function postToMock(path: string, body?: unknown) {
  const response = await fetch(`${MOCK_API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  expect(response.ok, `mock-api ${path} respondeu ${response.status}`).toBe(true);
}

export const mockApi = {
  control: (flags: MockControl) => postToMock('/__control', flags),
  reset: () => postToMock('/__reset'),
  requests: async (): Promise<MockRequest[]> => (await fetch(`${MOCK_API_URL}/__requests`)).json(),
};

export async function login(page: Page, account: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[account];

  await page.goto('/login');
  // Espera a hidratação antes de digitar, senão o React descarta o texto.
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

// Mensagens de console que não indicam bug do app.
const IGNORED_CONSOLE_ERRORS = [
  /fonts\.(googleapis|gstatic)\.com/, // fontes indisponíveis em rede restrita
  /\.hot-update\.(json|js)/, // recarregamento do webpack no modo dev; não existe no build de produção
  /Home visits lookup API error/, // log do servidor (repassado ao console em dev) quando o teste derruba a API
];

/**
 * Fixture padrão: cada teste começa com a API simulada nos dados iniciais
 * e falha se a página tiver erro de JavaScript ou erro de console inesperado.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      await mockApi.reset();

      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        // "Failed to load resource" não diz a URL; o listener de response abaixo registra com a URL.
        if (text.startsWith('Failed to load resource')) return;
        if (!IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) errors.push(`console: ${text}`);
      });
      page.on('response', (response) => {
        const url = response.url();
        if (response.status() >= 400 && !IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(url))) {
          errors.push(`HTTP ${response.status()} ${response.request().method()} ${url}`);
        }
      });

      await use(errors);

      expect(errors, 'erros de console/página durante o teste').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
