import { expect, login, mockApi, test } from './fixtures';

// Promotor usa o app no celular, em campo.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.describe('Home do promotor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'promotor');
    await page.waitForURL('/promotor');
  });

  test('lista as visitas do promotor com paginação', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Visitas', exact: true })).toBeVisible();
    await expect(page.locator('article')).toHaveCount(10);
    await expect(page.getByText('Loja Teste 23')).toBeVisible();
    await expect(page.getByText('Página 1 de 3 · 23 visitas')).toBeVisible();
    await expect(page.getByText('Rascunho', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Gôndola reorganizada; falta etiqueta de preço.')).toBeVisible();
    await expect(page.getByText('Nenhuma visita cadastrada ainda.')).toHaveCount(0);
  });

  test('a próxima página troca os itens da lista', async ({ page }) => {
    await page.getByRole('link', { name: 'Próxima' }).click();
    await page.waitForURL('/promotor?page=2');

    await expect(page.getByText('Página 2 de 3 · 23 visitas')).toBeVisible();
    await expect(page.getByText('Loja Teste 13')).toBeVisible();
    // Os itens da página 1 não podem ficar presos no estado da lista.
    await expect(page.getByText('Loja Teste 23')).toHaveCount(0);
    await expect(page.locator('article')).toHaveCount(10);
  });

  test('a última página desabilita "Próxima" e "Anterior" volta', async ({ page }) => {
    await page.goto('/promotor?page=3');
    await expect(page.locator('article')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Próxima' })).toHaveAttribute('aria-disabled', 'true');

    await page.getByRole('link', { name: 'Anterior' }).click();
    await page.waitForURL('/promotor?page=2');
    await expect(page.getByText('Loja Teste 13')).toBeVisible();
  });

  test('uma página além do fim mostra estado vazio específico', async ({ page }) => {
    await page.goto('/promotor?page=9');
    await expect(page.getByText('Não há visitas nesta página.')).toBeVisible();
  });

  test('API fora do ar mostra erro com "Tentar novamente", que recupera a lista', async ({ page }) => {
    await mockApi.control({ visitsStatus: 500 });
    await page.goto('/promotor');

    const error = page.getByText('Não foi possível carregar suas visitas');
    await expect(error).toBeVisible();
    // Erro não pode parecer "nenhuma visita".
    await expect(page.getByText('Nenhuma visita cadastrada ainda.')).toHaveCount(0);

    await mockApi.control({ visitsStatus: 200 });
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.locator('article')).toHaveCount(10);
    await expect(error).toHaveCount(0);
  });

  test('excluir rascunho tira o card e atualiza o total', async ({ page }) => {
    const draft = page.locator('article', { hasText: 'Loja Teste 23' });

    page.once('dialog', (dialog) => dialog.accept());
    await draft.getByRole('button', { name: 'Excluir rascunho' }).click();

    await expect(page.getByText('Rascunho excluído com sucesso.')).toBeVisible();
    await expect(draft).toHaveCount(0);
    await expect(page.getByText('Loja Teste 22')).toBeVisible();
    await expect(page.getByText(/· 22 visitas/)).toBeVisible();

    const requests = await mockApi.requests();
    expect(requests).toContainEqual(expect.objectContaining({ method: 'DELETE', path: '/promotor/visit/1023' }));
  });

  test('o detalhe da visita abre a partir da lista', async ({ page }) => {
    await page.locator('article').first().getByRole('link', { name: 'Ver' }).click();
    await page.waitForURL(/\/visitas\/\d+$/);

    await expect(page.getByText('Loja Teste 23').first()).toBeVisible();
    await expect(page.locator('header img[alt=Logo]')).toBeVisible();
  });

  test('sessão recusada pela API limpa a sessão e avisa no login', async ({ page, context }) => {
    await mockApi.control({ visitsStatus: 401 });
    await page.goto('/promotor');

    await page.waitForURL('/login?sessao=expirada');
    await expect(page.getByRole('status')).toContainText('Sua sessão expirou');

    const sessionCookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith('ff_'));
    expect(sessionCookies).toEqual([]);

    // Sem sessão, a home leva ao login, sem loop de redirecionamento.
    await page.goto('/promotor');
    await page.waitForURL(/\/login/);
  });
});

test.describe('Agenda do promotor', () => {
  test('mostra as lojas do promotor, sem permissão de edição', async ({ page }) => {
    await login(page, 'promotor');
    await page.waitForURL('/promotor');
    await page.getByRole('link', { name: 'Agenda' }).click();
    await page.waitForURL('/agenda');

    await expect(page.locator('article', { hasText: 'Centro' }).first()).toBeVisible();
    await expect(page.locator('article', { hasText: 'Norte' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  });
});
