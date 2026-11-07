import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function register(page: Page, name: string) {
  const email = `group-${crypto.randomUUID()}@example.test`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}
async function add(page: Page, name: string) {
  await page.getByLabel("Pesquisar pessoas pelo nome").fill(name);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  const result = page.getByRole("list", { name: "Resultados da pesquisa" }).getByRole("listitem").filter({ hasText: name });
  await result.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status", { name: "Atualização do grupo" })).toHaveText("Participante adicionado.");
}
async function confirm(page: Page, trigger: string, name?: string) {
  const source = name ? page.getByRole("list", { name: "Participantes" }).getByRole("listitem").filter({ hasText: name }) : page;
  if (name) {
    const options = source.locator("details");
    if (!await options.evaluate((element) => (element as HTMLDetailsElement).open)) await options.locator("summary").click();
  }
  await source.getByRole("button", { name: trigger, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Sim, / }).click();
}

test("grupos: inclusão direta, papéis, remoção, saída, transferência e encerramento", async ({ page, browser, baseURL }) => {
  test.setTimeout(60_000);
  const suffix = crypto.randomUUID().slice(0, 7);
  const adminName = `Ana ${suffix}`, memberName = `Bruna ${suffix}`, thirdName = `Carlos ${suffix}`;
  const otherContext = await browser.newContext({ baseURL });
  const thirdContext = await browser.newContext({ baseURL });
  try {
    const member = await otherContext.newPage(), third = await thirdContext.newPage();
    const memberEmail = await register(member, memberName);
    await register(third, thirdName);
    await register(page, adminName);
    await expect(page.getByRole("link", { name: "Criar grupo", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Criar grupo", exact: true }).click();
    await page.getByLabel("Nome do grupo").fill(`Família ${suffix}`);
    await page.getByLabel("Descrição (opcional)", { exact: true }).fill("Natal em família.");
    await page.getByRole("radio", { name: "Lista em grupo", exact: true }).check();
    await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Família ${suffix}`, exact: true })).toBeVisible();
    const groupUrl = page.url().split("?")[0];
    await member.goto(groupUrl);
    await expect(member.getByRole("heading", { name: "Grupo não encontrado." })).toBeVisible();
    await add(page, memberName); await add(page, thirdName);
    await expect(page.getByText("Lista em grupo · 3 participantes", { exact: true })).toBeVisible();
    expect(await page.content()).not.toContain(memberEmail);
    await member.goto("/dashboard");
    await expect(member.getByRole("heading", { name: `Família ${suffix}`, exact: true })).toBeVisible();
    await member.goto(`${groupUrl}/editar`);
    await expect(member.getByRole("heading", { name: "Grupo não encontrado." })).toBeVisible();
    await member.goto(groupUrl);
    await expect(member.getByLabel("Pesquisar pessoas pelo nome")).toHaveCount(0);
    await confirm(member, "Sair do grupo");
    await expect(member).toHaveURL(/\/grupos\?status=saida$/);
    await page.goto(groupUrl); await add(page, memberName);
    await page.getByRole("link", { name: "Editar grupo" }).click();
    await page.getByLabel("Nome do grupo").fill(`Família atualizada ${suffix}`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("heading", { name: `Família atualizada ${suffix}`, exact: true })).toBeVisible();
    await confirm(page, "Remover", thirdName);
    await third.goto(groupUrl);
    await expect(third.getByRole("heading", { name: "Grupo não encontrado." })).toBeVisible();
    await page.screenshot({ path: `test-results/${test.info().project.name}-grupo.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await confirm(page, "Transferir administração", memberName);
    await expect(page.getByLabel("Pesquisar pessoas pelo nome")).toHaveCount(0);
    await confirm(page, "Sair do grupo");
    await member.goto(groupUrl);
    await expect(member.getByText("Você administra este grupo.", { exact: true })).toBeVisible();
    await confirm(member, "Encerrar grupo");
    await expect(member).toHaveURL(/\/grupos\?status=encerrado$/);
    await page.goto("/grupos/novo");
    await page.getByLabel("Nome do grupo").fill(`Amigo secreto ${suffix}`);
    await page.getByRole("radio", { name: "Amigo secreto", exact: true }).check();
    await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
    await expect(page.getByText("Amigo secreto · 1 participante", { exact: true })).toBeVisible();
  } finally { await otherContext.close(); await thirdContext.close(); }
});
