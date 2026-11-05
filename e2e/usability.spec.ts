import { test, expect } from "./fixtures";

test("navegação clara, senha visível e formulário simples com cancelamento seguro", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Pessoa de teste");
  await page.getByLabel("Email", { exact: true }).fill(`usability-${crypto.randomUUID()}@example.test`);
  const password = page.getByLabel("Senha", { exact: true });
  await password.fill("secret");
  await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const navigation = page.getByRole("navigation", { name: "Menu principal" });
  await expect(navigation.getByRole("link", { name: "Início", exact: true })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Minha lista", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "Minha lista", exact: true })).toHaveAttribute("aria-current", "page");
  // Verificamos o alvo inteiro, não só o texto: deve ser confortável no toque.
  const bounds = await navigation.getByRole("link", { name: "Minha lista", exact: true }).boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(48);

  await page.goto("/presentes");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("link", { name: "Adicionar presente", exact: true }).click();
  await expect(page.getByLabel("Link da imagem (opcional)", { exact: true })).not.toBeVisible();
  await page.getByText("Adicionar uma imagem (opcional)", { exact: true }).click();
  await expect(page.getByLabel("Link da imagem (opcional)", { exact: true })).toBeVisible();
  await page.getByLabel("Nome do presente").fill("Livro de receitas");
  await page.getByLabel("Descrição", { exact: true }).fill("Receitas fáceis para o dia a dia.");
  await page.getByLabel("Link do produto", { exact: true }).fill("https://example.test/livro");
  await page.getByRole("button", { name: "Salvar presente", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Presente adicionado à sua lista.");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Desistir deve preservar o presente e devolver o foco à ação de origem.
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Livro de receitas", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-lista-simples.png`, fullPage: true });
  // Tela estreita e fonte duplicada: manter o acesso sem rolagem lateral é
  // especialmente importante para quem precisa ampliar os textos para ler.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-texto-ampliado.png`, fullPage: true });
});
