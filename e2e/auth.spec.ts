import { test, expect } from "./fixtures";

test("cadastro → perfil → logout → login, com proteção e erros", async ({ page }) => {
  const email = `browser-${Date.now()}@example.test`;
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByRole("link", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome").fill("Pessoa de Teste");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.screenshot({ path: `test-results/${test.info().project.name}-cadastro.png`, fullPage: true });
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Olá, Pessoa de Teste." })).toBeVisible();
  await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-perfil.png`, fullPage: true });
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email ou senha inválidos." })).toHaveText("Email ou senha inválidos.");
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  // Sem credenciais persistidas no storage acessível ao JavaScript.
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
