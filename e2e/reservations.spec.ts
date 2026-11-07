import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function register(page: Page, name: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(`reservation-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function createGroup(page: Page, name: string, secret = false) {
  await page.goto("/grupos/novo");
  await page.getByLabel("Nome do grupo").fill(name);
  await page.getByRole("radio", { name: secret ? "Amigo secreto" : "Lista em grupo", exact: true }).check();
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return page.url().split("?")[0];
}
async function add(page: Page, name: string) {
  await page.getByLabel("Pesquisar pessoas pelo nome").fill(name);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.getByRole("list", { name: "Resultados da pesquisa" }).getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status", { name: "Atualização do grupo" })).toHaveText("Participante adicionado.");
}

test("reservas: privacidade do dono, cancelamento, grupos independentes e perda de acesso", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const suffix = crypto.randomUUID().slice(0, 7);
  const ownerName = `Bruna ${suffix}`, otherName = `Carlos ${suffix}`;
  const ownerContext = await browser.newContext({ baseURL }), otherContext = await browser.newContext({ baseURL });
  try {
    const owner = await ownerContext.newPage(), other = await otherContext.newPage();
    await register(owner, ownerName); await register(other, otherName); await register(page, `Ana ${suffix}`);
    await owner.goto("/presentes/novo");
    await owner.getByLabel("Nome do presente").fill("Tênis de caminhada");
    await owner.getByLabel("Descrição", { exact: true }).fill("Número 38, azul.");
    await owner.getByLabel("Link do produto", { exact: true }).fill("https://example.test/tenis");
    await owner.getByRole("button", { name: "Salvar presente", exact: true }).click();
    await expect(owner.getByRole("status")).toHaveText("Presente adicionado à sua lista.");

    const groupUrl = await createGroup(page, `Família ${suffix}`); await add(page, ownerName); await add(page, otherName);
    const ownerRow = page.getByRole("list", { name: "Participantes" }).getByRole("listitem").filter({ hasText: ownerName });
    const listPath = (await ownerRow.getByRole("link", { name: "Ver lista de presentes", exact: true }).getAttribute("href"))!;
    const ownerId = listPath.split("/").at(-1)!;
    await page.goto(listPath);
    await expect(page.getByText("Disponível neste grupo", { exact: true })).toBeVisible();
    await other.goto(listPath);
    await expect(other.getByText("Disponível neste grupo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");
    await expect(page.getByRole("button", { name: "Cancelar minha reserva", exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/${test.info().project.name}-reserva.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await owner.goto(listPath);
    await expect(owner.getByRole("heading", { name: "Tênis de caminhada", exact: true })).toBeVisible();
    await expect(owner.getByText("Reservado neste grupo", { exact: true })).toHaveCount(0);
    await expect(owner.getByText("Disponível neste grupo", { exact: true })).toHaveCount(0);
    await expect(owner.getByRole("button", { name: "Reservar presente", exact: true })).toHaveCount(0);
    await expect(owner.getByRole("button", { name: "Cancelar minha reserva", exact: true })).toHaveCount(0);
    // A terceira sessão ainda tem a tela anterior: a disputa é resolvida no
    // backend, e a recuperação não exige saber usar o botão atualizar do browser.
    await other.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(other.getByRole("alert").filter({ hasText: "já está reservado" })).toContainText("já está reservado");
    await expect(other.getByRole("button", { name: "Atualizar lista", exact: true })).toBeVisible({ timeout: 2000 });
    await other.getByRole("button", { name: "Atualizar lista", exact: true }).click();
    await expect(other.getByText("Reservado neste grupo", { exact: true })).toBeVisible();
    await expect(other.getByRole("button", { name: "Cancelar minha reserva", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Cancelar minha reserva", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByText("Reservado neste grupo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar minha reserva", exact: true }).click();
    await page.getByRole("button", { name: "Sim, cancelar reserva", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Reserva cancelada. O presente está disponível neste grupo.");
    await other.reload(); await other.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(other.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");

    const otherGroup = await createGroup(page, `Amigos ${suffix}`); await add(page, ownerName);
    const otherList = `${otherGroup}/listas/${ownerId}`;
    await page.goto(otherList); await expect(page.getByText("Disponível neste grupo", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");
    await other.goto(groupUrl); await other.getByRole("button", { name: "Sair do grupo", exact: true }).click();
    await other.getByRole("button", { name: "Sim, sair", exact: true }).click();
    await expect(other).toHaveURL(/\/grupos\?status=saida$/);
    await other.goto(listPath); await expect(other.getByRole("heading", { name: "Lista não encontrada.", exact: true })).toBeVisible();
    await page.goto(listPath); await expect(page.getByText("Disponível neste grupo", { exact: true })).toBeVisible();
    await page.goto(otherList); await expect(page.getByText("Reservado neste grupo", { exact: true })).toBeVisible();

    const secret = await createGroup(page, `Segredo ${suffix}`, true); await add(page, ownerName);
    await expect(page.getByRole("link", { name: "Ver lista de presentes", exact: true })).toHaveCount(0);
    await page.goto(`${secret}/listas/${ownerId}`);
    await expect(page.getByRole("heading", { name: "Lista não encontrada.", exact: true })).toBeVisible();
  } finally { await ownerContext.close(); await otherContext.close(); }
});
