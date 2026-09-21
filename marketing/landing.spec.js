import { test, expect } from "@playwright/test";
test("home navigation and dedicated pages", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Sua obra",
  );
  await expect(page.getByText("R$ 119,90")).toHaveCount(0);
  await page.getByRole("link", { name: "Conheça os planos" }).click();
  await expect(page).toHaveURL(/\/planos$/);
  await expect(page.getByText("R$ 119,90")).toBeVisible();
  await page.getByRole("button", { name: "Anual", exact: true }).click();
  await expect(page.getByText("R$ 99,91")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Escolher este plano" }).first(),
  ).toHaveAttribute("href", /Anual/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "O plano certo",
  );
  await page.goto("/sobre-nos");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Construir exige",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("video respects reduced motion and mobile menu works", async ({
  page,
  isMobile,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Pausar|Reproduzir vídeo/ })).toHaveCount(0);
  expect(
    await page.locator("video").first().evaluate((v) => v.paused && v.muted && v.loop),
  ).toBe(true);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Navegação móvel" })
      .getByRole("link", { name: "Sobre nós" })
      .click();
    await expect(page).toHaveURL(/\/sobre-nos$/);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('video decodes without pause buttons and privacy preference persists', async ({page})=>{
 await page.goto('/');
 await expect.poll(()=>page.locator('video').first().evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
 await expect(page.getByRole('button',{name:/Pausar/})).toHaveCount(0);
 expect(await page.locator('video').first().evaluate(v=>v.paused)).toBe(false);
 await page.getByRole('button',{name:'Entendi',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'Entendi',exact:true})).toHaveCount(0);
});
test('original brand, footer and five FAQ answers are restored',async({page})=>{
 await page.goto('/');
 await expect(page.locator('header img[src="/img/fingo/fingo-symbol.png"]')).toBeVisible();
 await expect(page.locator('header').getByText('OBRAS EM FLUXO')).toBeVisible();
 const faq=page.locator('#faq');await expect(faq.locator('details')).toHaveCount(5);
 await faq.locator('summary').filter({hasText:'Como funciona o limite de usuários ativos?'}).click();
 await expect(faq.getByText(/O limite é contado por pessoas/)).toBeVisible();
 const footer=page.getByRole('navigation',{name:'Rodapé'});
 for(const label of ['Área do Cliente','Newsletter & Novidades','Validar Documento ICP','Privacidade & LGPD','Termos de Uso','Suporte WhatsApp','Planos','Sobre nós']) await expect(footer.getByRole('link',{name:label,exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('newsletter reports server persistence failure',async({page})=>{
 await page.route('**/api/v2/public/newsletter/*',route=>route.fulfill({status:503,json:{success:false}}));
 await page.goto('/');await page.getByLabel('Seu e-mail corporativo ou pessoal').fill('teste@example.com');
 await page.getByRole('button',{name:'Inscrever-se'}).click();
 await expect(page.getByRole('status')).toContainText('temporariamente indisponíveis');
 await page.getByRole('button',{name:'cancelar sua inscrição',exact:true}).click();
 await expect(page.getByRole('form',{name:'Cancelar inscrição no Radar FinGo'})).toBeVisible();
});

test('tour precedes FAQ, plays chapters and backgrounds remain plain',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 const tour=page.locator('#tour');await tour.scrollIntoViewIfNeeded();
 expect(await page.locator('#fingo-feature-video').evaluate(v=>v.paused&&v.loop&&v.muted)).toBe(true);
 await tour.getByRole('button',{name:'3. Medições & Retenções',exact:true}).click();
 await expect(tour.getByRole('button',{name:'Pausar tour'})).toHaveCount(0);
 await expect.poll(()=>page.locator('#fingo-feature-video').evaluate(v=>v.currentTime)).toBeGreaterThanOrEqual(8);

 expect(await page.evaluate(()=>!!(document.querySelector('#tour').compareDocumentPosition(document.querySelector('#faq'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 for(const selector of ['#faq','#newsletter','footer'])expect(await page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundImage)).toBe('none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('public FinBot answers questions and offers human contact',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Tirar dúvidas com o FinBot'}).click();
 const panel=page.getByRole('dialog',{name:'Converse com o FinBot'});await expect(panel).toBeVisible();
 await expect(page.getByLabel('Sua dúvida para o FinBot')).toBeFocused();
 await panel.getByRole('button',{name:'Conhecer planos',exact:true}).click();
 await expect(panel.getByRole('log')).toContainText('R$ 119,90');
 await page.getByLabel('Sua dúvida para o FinBot').fill('O teste é grátis?');
 await panel.getByRole('button',{name:'Enviar mensagem'}).click();
 await expect(panel.getByRole('log')).toContainText('A solicitação leva menos de 1 minuto');
 await expect(panel.getByRole('link',{name:'Falar com a equipe no WhatsApp'})).toHaveAttribute('href',/^https:\/\/wa.me\/5595991363678/);
 expect(await panel.evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth)).toBe(true);
 await page.getByLabel('Sua dúvida para o FinBot').press('Escape');await expect(panel).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Tirar dúvidas com o FinBot'})).toBeFocused();
});
