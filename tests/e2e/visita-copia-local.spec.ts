import type { Page } from '@playwright/test';

import { expect, login, test } from './fixtures';

// Promotor usa o app no celular, em campo.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// PNG 1x1 transparente.
const PHOTO = {
  name: 'antes.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  ),
};

/** Quantos formulários e fotos estão gravados no IndexedDB do aparelho. */
function readLocalCopy(page: Page) {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();

    // Não abre o banco antes do app: abrir cria um banco vazio, sem os object stores.
    if (!databases.some((database) => database.name === 'fiu-fiu-visit-form')) {
      return { forms: 0, images: 0 };
    }

    return new Promise<{ forms: number; images: number }>((resolve, reject) => {
      const request = indexedDB.open('fiu-fiu-visit-form');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['forms', 'images'], 'readonly');
        const forms = transaction.objectStore('forms').count();
        const images = transaction.objectStore('images').count();
        transaction.oncomplete = () => {
          db.close();
          resolve({ forms: forms.result, images: images.result });
        };
      };
    });
  });
}

async function openNewVisit(page: Page) {
  await page.goto('/visitas/nova');
  // Espera a hidratação antes de digitar, senão o React descarta o texto.
  await page.waitForLoadState('networkidle');
}

async function fillVisitWithPhoto(page: Page) {
  await page.locator('#observation').fill('Faltando etiqueta de preço na gôndola.');
  await page.getByRole('button', { name: 'Adicionar produto' }).click();
  await page.locator('select').first().selectOption('ICE Cajalemon');
  await page.locator('input[type="number"]').first().fill('4');
  await page.locator('#before-images-input').setInputFiles(PHOTO);
  await expect(page.getByText('Nova foto')).toHaveCount(1);

  await expect.poll(() => readLocalCopy(page)).toEqual({ forms: 1, images: 1 });
}

test.describe('Cópia local do formulário de visita', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'promotor');
    await page.waitForURL('/promotor');
  });

  test('fechar e reabrir a aba recupera campos e fotos', async ({ page, context }) => {
    await openNewVisit(page);
    await fillVisitWithPhoto(page);

    await page.close();
    const reopened = await context.newPage();
    await openNewVisit(reopened);

    const banner = reopened.getByRole('region', { name: 'Visita nao enviada encontrada' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('com 1 foto.');

    await banner.getByRole('button', { name: 'Continuar de onde parou' }).click();

    await expect(banner).toHaveCount(0);
    await expect(reopened.locator('#observation')).toHaveValue('Faltando etiqueta de preço na gôndola.');
    await expect(reopened.locator('select').first()).toHaveValue('ICE Cajalemon');
    await expect(reopened.locator('input[type="number"]').first()).toHaveValue('4');
    await expect(reopened.getByText('Nova foto')).toHaveCount(1);
    await expect(reopened.getByRole('img', { name: 'Antes 1' })).toHaveAttribute('src', /^blob:/);
    // A foto restaurada precisa carregar de verdade, não só ter um src.
    await expect
      .poll(() => reopened.getByRole('img', { name: 'Antes 1' }).evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBe(1);
  });

  test('descartar começa um formulário vazio e apaga a cópia do aparelho', async ({ page }) => {
    await openNewVisit(page);
    await fillVisitWithPhoto(page);

    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const banner = page.getByRole('region', { name: 'Visita nao enviada encontrada' });
    await banner.getByRole('button', { name: 'Descartar' }).click();

    await expect(banner).toHaveCount(0);
    await expect(page.locator('#observation')).toHaveValue('');
    await expect(page.getByText('Nenhum produto adicionado ainda.')).toBeVisible();
    await expect.poll(() => readLocalCopy(page)).toEqual({ forms: 0, images: 0 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('region', { name: 'Visita nao enviada encontrada' })).toHaveCount(0);
  });

  test('sair por um link com alterações pede confirmação', async ({ page }) => {
    await openNewVisit(page);
    await page.locator('#observation').fill('Visita em andamento');

    const backLink = page.getByRole('link', { name: 'Voltar para o início' });

    const dismissed = page.waitForEvent('dialog');
    page.once('dialog', (dialog) => dialog.dismiss());
    await backLink.click();
    expect((await dismissed).message()).toContain('ainda nao foram enviadas');
    await expect(page).toHaveURL('/visitas/nova');
    await expect(page.locator('#observation')).toHaveValue('Visita em andamento');

    page.once('dialog', (dialog) => dialog.accept());
    await backLink.click();
    await page.waitForURL('/promotor');
  });

  test('abrir um rascunho para editar, sem mexer, não cria cópia local', async ({ page }) => {
    await page.goto('/visitas/1023/editar');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Continuar rascunho' })).toBeVisible();

    // Maior que o intervalo do salvamento automático.
    await page.waitForTimeout(1500);
    expect(await readLocalCopy(page)).toEqual({ forms: 0, images: 0 });

    await page.getByRole('link', { name: /Voltar/ }).first().click();
    await expect(page).not.toHaveURL(/editar/);
  });

  test('sem alterações, sai sem perguntar', async ({ page }) => {
    await openNewVisit(page);

    // Sem handler de dialog: se aparecesse um confirm, o Playwright cancelaria e o teste ficaria na página.
    await page.getByRole('link', { name: 'Voltar para o início' }).click();
    await page.waitForURL('/promotor');
  });
});
