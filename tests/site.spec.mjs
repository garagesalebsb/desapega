import { test as base, expect } from '@playwright/test';
import { firstSale } from './helpers.mjs';

// Toda página testada também falha se aparecer erro de JavaScript no console.
const IGNORE = /Failed to load resource|tile\.openstreetmap|favicon/i;
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text()));
    await use(page);
    expect(errors, 'erros de JavaScript na página').toEqual([]);
  },
});

const UUID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

test.describe('Visitante sem login', () => {
  test('início mostra filtros, mapa e as vendas (ou o aviso de vazio)', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: /Vendas de garagem, bazares e mudanças/ })).toBeVisible();
    await expect(page.locator('#f-region option')).toHaveCount(36); // "Todo o DF" + 35 regiões
    await expect(page.locator('#home-map.leaflet-container')).toBeVisible();
    await expect(page.locator('#home-list .sale-card, #home-list .empty').first()).toBeVisible();
  });

  test('a tela cabe no celular, sem rolagem para o lado', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#home-list .sale-card, #home-list .empty').first()).toBeVisible();
    const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    expect(scroll).toBeLessThanOrEqual(width);
  });

  test('trocar de tela rápido não gera erro no mapa', async ({ page }) => {
    await page.goto('./');
    for (const hash of ['#/?regiao=Guar%C3%A1', '#/buscar', '#/?quando=todas', '#/', '#/?regiao=Lago%20Sul']) {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(30);
    }
    await expect(page.locator('#home-list .sale-card, #home-list .empty').first()).toBeVisible();
    await page.waitForTimeout(500); // deixa terminar qualquer animação pendente
  });

  test('filtro por região vai para o endereço e fica lembrado', async ({ page }) => {
    await page.goto('./');
    await page.locator('#f-region').selectOption('Guará');
    await expect(page).toHaveURL(/regiao=Guar/);
    await page.goto('./');
    await expect(page.locator('#f-region')).toHaveValue('Guará');
  });

  test('sem internet mostra aviso e permite tentar de novo', async ({ page }) => {
    await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Sem conexão' })).toBeVisible();
    await page.unroute('**/rest/v1/**');
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.locator('#home-list .sale-card, #home-list .empty').first()).toBeVisible();
  });

  test('perto de mim pede a localização e ordena por distância', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -15.7939, longitude: -47.8828 }); // Plano Piloto
    await page.goto('./');
    await page.getByRole('button', { name: 'Perto de mim' }).click();
    await expect(page).toHaveURL(/perto=1/);
    await expect(page.getByRole('button', { name: 'Perto de mim' })).toHaveAttribute('aria-pressed', 'true');
    const card = page.locator('#home-list .sale-card').first();
    if (await card.count()) await expect(card).toContainText(/\d+(,\d)? ?(km|m)/);
    else await expect(page.locator('#home-list .empty')).toBeVisible();
    await page.getByRole('button', { name: 'Perto de mim' }).click();
    await expect(page).not.toHaveURL(/perto=1/);
  });

  test('perto de mim sem permissão avisa o motivo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'o Safari de teste não simula a recusa de permissão');
    await page.goto('./');
    await page.getByRole('button', { name: 'Perto de mim' }).click();
    await expect(page.getByText(/Não foi possível obter sua localização/)).toBeVisible();
  });

  test('menu inferior abre a busca', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Buscar' }).click();
    await expect(page.getByPlaceholder(/sofá, bicicleta/)).toBeVisible();
  });

  test('busca sem resultado mostra aviso', async ({ page }) => {
    await page.goto('./#/buscar');
    await page.getByPlaceholder(/sofá, bicicleta/).fill('zzz-item-que-nao-existe-123');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByRole('heading', { name: 'Nada encontrado' })).toBeVisible();
  });

  test('anunciar pede login, com Google, e-mail e links legais', async ({ page }) => {
    await page.goto('./#/anunciar');
    await expect(page.getByText('Entre para anunciar uma venda')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
    await expect(page.getByLabel('Seu e-mail')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', 'termos.html');
  });

  test('minhas vendas e perfil pedem login', async ({ page }) => {
    await page.goto('./#/minhas');
    await expect(page.getByText('Entre para ver suas vendas e favoritas')).toBeVisible();
    await page.goto('./#/perfil');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('página da venda mostra os dados, rotas e pede login para o WhatsApp', async ({ page, request }) => {
    const sale = await firstSale(request);
    test.skip(!sale, 'nenhuma venda publicada para testar');
    await page.goto(`./#/venda/${sale.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sale.title);
    await expect(page.getByRole('link', { name: 'Rota no Google Maps' })).toHaveAttribute('href', new RegExp(`${sale.lat},${sale.lng}`));
    await expect(page.getByRole('link', { name: 'Rota no Waze' })).toHaveAttribute('href', /waze\.com/);
    await expect(page.locator('#sale-map.leaflet-container')).toBeVisible();
    const calendar = page.getByRole('button', { name: 'Adicionar à agenda' });
    if (await calendar.count()) { // some quando a venda já fechou hoje
      await calendar.click();
      await expect(page.getByRole('link', { name: 'Google Agenda' })).toHaveAttribute('href', /calendar\.google\.com.*dates=\d{8}T\d{6}Z/);
      await page.getByRole('button', { name: 'Cancelar' }).click();
    }
    await page.getByRole('button', { name: 'Falar no WhatsApp' }).click();
    await expect(page).toHaveURL(/#\/entrar/);
    await expect(page.getByText('Entre para falar com o vendedor')).toBeVisible();
  });

  test('foto do item abre a galeria', async ({ page, request }) => {
    const sale = await firstSale(request);
    test.skip(!sale, 'nenhuma venda publicada para testar');
    await page.goto(`./#/venda/${sale.id}`);
    await expect(page.locator('#items-title')).not.toBeEmpty(); // espera os itens aparecerem
    const photo = page.locator('#items [data-act=view-item]').first();
    test.skip(!(await photo.count()), 'a venda não tem itens');
    await photo.click();
    await expect(page.locator('.modal.viewer')).toBeVisible();
    await page.locator('.modal.viewer').getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('.modal.viewer')).toHaveCount(0);
  });

  test('cartaz da venda tem título, data, QR Code e botões de imprimir e WhatsApp', async ({ page, request }) => {
    const sale = await firstSale(request);
    test.skip(!sale, 'nenhuma venda publicada para testar');
    await page.goto(`./#/venda/${sale.id}/cartaz`);
    await expect(page.locator('.poster h1')).toHaveText(sale.title);
    await expect(page.locator('.poster-when')).toContainText(/\d+h às \d+h/);
    await expect(page.locator('#poster-qr svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir ou salvar PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Imagem para WhatsApp/ })).toBeVisible();
    await expect(page.locator('.tabbar')).toBeVisible(); // na tela o menu continua; só some na impressão
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.tabbar')).toBeHidden();
    await expect(page.locator('.poster-tools')).toBeHidden();
  });

  test('venda inexistente mostra aviso', async ({ page }) => {
    await page.goto(`./#/venda/${UUID_INEXISTENTE}`);
    await expect(page.getByRole('heading', { name: 'Venda não encontrada' })).toBeVisible();
  });

  test('link de compartilhamento sem prévia leva para a venda', async ({ page }) => {
    await page.goto(`./v/${UUID_INEXISTENTE}/`);
    await expect(page).toHaveURL(new RegExp(`#/venda/${UUID_INEXISTENTE}$`));
    await expect(page.getByRole('heading', { name: 'Venda não encontrada' })).toBeVisible();
  });

  test('política de privacidade e termos abrem', async ({ page }) => {
    await page.goto('./privacidade.html');
    await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
    await page.goto('./termos.html');
    await expect(page.getByRole('heading', { name: 'Termos de Uso' })).toBeVisible();
  });
});

test('app pode ser instalado (manifesto e ícones)', async ({ request }) => {
  const manifest = await (await request.get('./manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    expect((await request.get(`./${icon.src}`)).status(), icon.src).toBe(200);
  }
});
