import type { Page } from '@playwright/test';

import { expect, login, mockApi, test } from './fixtures';

async function openStoreEditor(page: Page, storeName: string) {
  await page.goto('/agenda');
  await page.locator('article', { hasText: storeName }).first().getByRole('button', { name: 'Editar' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Perfil comercial', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'comercial');
    await page.waitForURL(/\/comercial/);
  });

  test('entra direto na tela Comercial', async ({ page }) => {
    await expect(page.locator('header img[alt=Logo]')).toBeVisible();
  });

  test('edita uma loja atendida via PATCH /promotor/agenda/{id}', async ({ page }) => {
    const dialog = await openStoreEditor(page, 'Norte');

    await dialog.locator('#edit-store-nickname').fill('Norte (editado)');
    await dialog.getByRole('button', { name: /Salvar/ }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Norte (editado)').first()).toBeVisible();

    const requests = await mockApi.requests();
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'PATCH',
        path: '/promotor/agenda/901',
        body: expect.objectContaining({ nickname: 'Norte (editado)' }),
      })
    );
  });

  test('cadastra e edita um cliente comercial pelas rotas /commercial-visits (FIUFIU-32)', async ({ page }) => {
    await page.goto('/comercial/novo');
    await page.locator('#clientName').fill('Bar do Zé LTDA');
    await page.locator('#fantasyName').fill('Bar do Zé');
    await page.locator('#phone').fill('62999990000');
    await page.locator('#address').fill('Rua 1, Centro');
    await page.getByPlaceholder('dd/mm/aaaa').first().fill('10/11/2026');
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();

    await page.waitForURL(/\/comercial\/1$/);
    await expect(page.getByText('Bar do Zé LTDA').first()).toBeVisible();
    await expect(page.getByText('10/11/2026')).toBeVisible();

    await page.goto('/comercial/1/editar');
    await expect(page.getByPlaceholder('dd/mm/aaaa').first()).toHaveValue('10/11/2026');
    await page.locator('#fantasyName').fill('Bar do Zé (editado)');
    await page.getByRole('button', { name: /Salvar altera/ }).click();
    await page.waitForURL(/\/comercial\/1$/);

    const requests = await mockApi.requests();
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/commercial-visits',
        body: expect.objectContaining({ clientName: 'Bar do Zé LTDA', visitDates: ['2026-11-10'] }),
      })
    );
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: 'PUT',
        path: '/commercial-visits/1',
        body: expect.objectContaining({ fantasyName: 'Bar do Zé (editado)' }),
      })
    );
    // Visita comercial nunca pode escrever na rota de visita de promotor.
    expect(requests.some((request) => request.path.startsWith('/promotor/visit'))).toBe(false);
  });

  test('mostra erro, sem fechar o editor, quando a API não publica a rota de edição', async ({ page }) => {
    // Reproduz o bug da FIUFIU-30: handler existia, mas a rota não estava no serverless.yml.
    await mockApi.control({ agendaPatchRouteExists: false });
    const dialog = await openStoreEditor(page, 'Norte');

    await dialog.locator('#edit-store-nickname').fill('Norte (sem rota)');
    await dialog.getByRole('button', { name: /Salvar/ }).click();

    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});
