import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function register(page: Page) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Pessoa da Lista");
  await page.getByLabel("Email", { exact: true }).fill(`gift-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function fillGift(page: Page) {
  await page.getByLabel("Nome do presente").fill("Livro de Natal");
  await page.getByLabel("Descrição", { exact: true }).fill("Receitas para celebrar em família.");
  await page.getByLabel("Link do produto").fill("https://example.test/livro");
  await page.getByText("Adicionar uma imagem (opcional)", { exact: true }).click();
  await page.getByLabel("Link da imagem (opcional)", { exact: true }).fill("https://images.example.test/gift-test.png");
}

test("lista pessoal: erro de URL, cadastro, edição e exclusão confirmada", async ({ page }) => {
  await page.route("https://images.example.test/gift-test.png", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#163f2d"/><rect x="200" y="80" width="200" height="260" rx="12" fill="#fff9f0"/><path d="M225 130h150M225 160h150" stroke="#ab2036" stroke-width="8"/></svg>',
  }));
  await page.goto("/presentes");
  await expect(page).toHaveURL(/\/entrar$/);
  await register(page);
  await page.getByRole("link", { name: "Minha lista", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Você ainda não adicionou presentes." })).toBeVisible();
  await page.getByRole("link", { name: "Adicionar presente", exact: true }).click();
  await fillGift(page);
  await page.getByLabel("Link do produto").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(page.getByText("Informe uma URL HTTP ou HTTPS válida, sem credenciais.", { exact: true })).toBeVisible();
  await page.getByLabel("Link do produto").fill("https://example.test/livro");
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(page.getByRole("status")).toHaveText("Presente adicionado à sua lista.");
  await expect(page.getByRole("heading", { name: "Livro de Natal", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Livro de Natal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver na loja" })).toHaveAttribute("target", "_blank");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-presentes.png`, fullPage: true });
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue("Receitas para celebrar em família.");
  await page.getByLabel("Nome do presente").fill("Livro de receitas de Natal");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("status")).toHaveText("Presente atualizado.");
  await expect(page.getByRole("heading", { name: "Livro de receitas de Natal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.screenshot({ path: `test-results/${test.info().project.name}-excluir-presente.png`, fullPage: true });
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Livro de receitas de Natal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("button", { name: "Excluir presente", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Presente excluído.");
  await expect(page.getByRole("heading", { name: "Você ainda não adicionou presentes." })).toBeVisible();
});

test("outro usuário não vê a lista nem acessa a edição conhecendo o ID", async ({ page, browser, baseURL }) => {
  await page.route("https://images.example.test/gift-test.png", (route) => route.abort());
  await register(page);
  await page.goto("/presentes/novo");
  await fillGift(page);
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(page.getByRole("img", { name: "Imagem ilustrativa de Livro de Natal" })).toHaveAttribute("src", "/images/gift-default.svg");
  const editUrl = await page.getByRole("link", { name: "Editar" }).getAttribute("href");
  const context = await browser.newContext({ baseURL });
  try {
    const stranger = await context.newPage();
    await register(stranger);
    await stranger.goto("/presentes");
    await expect(stranger.getByRole("heading", { name: "Livro de Natal", exact: true })).toHaveCount(0);
    const response = await stranger.goto(editUrl!);
    // loading.tsx permite streaming: o Next mantém 200 se os headers já saíram.
    // A negação real precisa mostrar not-found/noindex e nunca serializar o presente.
    expect([200, 404]).toContain(response?.status());
    await expect(stranger.getByRole("heading", { name: "Presente não encontrado." })).toBeVisible();
    // O framework pode emitir metadados equivalentes no head e no stream do body.
    // O contrato é a presença de noindex, não a quantidade/posição dessas tags.
    await expect(stranger.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
    const payload = await response!.text();
    expect(payload).not.toContain("Receitas para celebrar em família.");
    expect(payload).not.toContain("https://example.test/livro");
  } finally { await context.close(); }
});

test("imagem opcional usa ilustração padrão", async ({ page }) => {
  await register(page);
  await page.goto("/presentes/novo");
  await fillGift(page);
  await page.getByLabel("Link da imagem (opcional)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Salvar presente" }).click();
  await expect(page.getByRole("status")).toHaveText("Presente adicionado à sua lista.");
  const image = page.getByRole("img", { name: "Imagem ilustrativa de Livro de Natal" });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", "/images/gift-default.svg");
  await page.screenshot({ path: `test-results/${test.info().project.name}-presentes-padrao.png`, fullPage: true });
});
