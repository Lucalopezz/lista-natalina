import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
async function register(page: Page, name: string) {
  await page.goto("/cadastro"); await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(`draw-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/sign-up/email") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  const id = (await (await response).json()).user.id as string;
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/presentes/novo");
  await page.getByLabel("Nome do presente").fill(`Presente de ${name}`);
  await page.getByLabel("Descrição", { exact: true }).fill(`Detalhes para ${name}`);
  await page.getByLabel("Link do produto").fill("https://example.test/presente");
  await page.getByRole("button", { name: "Salvar presente", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Presente adicionado à sua lista.");
  return id;
}
async function createGroup(page: Page, name: string, secret = true) {
  await page.goto("/grupos/novo"); await page.getByLabel("Nome do grupo").fill(name);
  await page.getByRole("radio", { name: secret ? "Amigo secreto" : "Lista em grupo", exact: true }).check();
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return page.url().split("?")[0];
}
async function add(page: Page, name: string) {
  await page.getByLabel("Pesquisar pessoas pelo nome").fill(name); await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.getByRole("list", { name: "Resultados da pesquisa" }).getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Participante adicionado.");
}
async function confirm(page: Page, operation: string) {
  await page.getByRole("button", { name: operation, exact: true }).click();
  await page.getByRole("dialog", { name: operation, exact: true }).getByRole("button", { name: /^Sim, / }).click();
}
test("amigo secreto: mínimo, resultado privado, refazer, reservas e invalidação", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const suffix = crypto.randomUUID().slice(0, 6), names = [`Ana ${suffix}`, `Bruna ${suffix}`, `Carlos ${suffix}`];
  const bContext = await browser.newContext({ baseURL }), cContext = await browser.newContext({ baseURL });
  try {
    const b = await bContext.newPage(), c = await cContext.newPage();
    const userIds = [await register(page, names[0]), await register(b, names[1]), await register(c, names[2])];
    const url = await createGroup(page, `Natal ${suffix}`); await add(page, names[1]);
    await expect(page.getByRole("button", { name: "Realizar sorteio", exact: true })).toBeDisabled({ timeout: 2000 });
    await add(page, names[2]);
    await page.getByRole("button", { name: "Realizar sorteio", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("link", { name: "Meu amigo secreto", exact: true })).toHaveCount(0);
    await confirm(page, "Realizar sorteio");
    await expect(page.getByRole("status")).toHaveText("Sorteio realizado. Cada pessoa já pode consultar seu amigo secreto.");
    await expect(page.getByLabel("Pesquisar pessoas pelo nome")).toHaveCount(0);
    const resultUrl = `${url}/amigo-secreto`;
    const recipients: string[] = [];
    for (const [index, memberPage] of [page, b, c].entries()) {
      await memberPage.goto(`${resultUrl}?giverId=${userIds[(index + 1) % 3]}`);
      const recipient = (await memberPage.getByRole("region", { name: "Pessoa sorteada", exact: true }).getByRole("heading", { level: 2 }).textContent())!;
      recipients.push(recipient); expect(recipient).not.toBe(names[index]);
      await expect(memberPage.getByRole("heading", { name: `Presente de ${recipient}`, exact: true })).toBeVisible();
      for (const hidden of names.filter((name) => name !== recipient)) await expect(memberPage.getByRole("heading", { name: `Presente de ${hidden}`, exact: true })).toHaveCount(0);
      await expect(memberPage.getByRole("button", { name: "Refazer sorteio", exact: true })).toHaveCount(0);
    }
    expect(new Set(recipients)).toEqual(new Set(names));
    const targetId = userIds[names.indexOf(recipients[0])];
    const deniedId = userIds.find((id) => id !== userIds[0] && id !== targetId)!;
    await page.goto(`${url}/listas/${deniedId}`);
    await expect(page.getByRole("heading", { name: "Lista não encontrada.", exact: true })).toBeVisible();
    await page.goto(resultUrl); await page.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(page).toHaveURL(`${resultUrl}?status=reservado`);
    await expect(page.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");
    const other = await createGroup(page, `Família ${suffix}`, false); await add(page, names[1]); await add(page, names[2]);
    await page.goto(`${other}/listas/${targetId}`); await page.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");
    await b.goto(url);
    await expect(b.getByRole("button", { name: "Sair do grupo", exact: true })).toHaveCount(0);
    await expect(b.getByRole("button", { name: "Refazer sorteio", exact: true })).toHaveCount(0);
    await page.goto(url); await page.getByRole("button", { name: "Refazer sorteio", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("reservas");
    await page.getByRole("dialog").getByRole("button", { name: "Voltar", exact: true }).click();
    await page.goto(resultUrl); await expect(page.getByRole("button", { name: "Cancelar minha reserva", exact: true })).toBeVisible();
    await page.goto(url); await confirm(page, "Refazer sorteio");
    await expect(page.getByRole("status")).toHaveText("Sorteio refeito. Consulte seu novo resultado.");
    await page.goto(resultUrl); await expect(page.getByText("Disponível neste grupo", { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/${test.info().project.name}-amigo-secreto.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Reservar presente", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Presente reservado. O dono não vê esta informação.");
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Ver meu amigo secreto", exact: true })).toBeVisible();
    await page.goto("/amigos-secretos");
    await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Meus grupos", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 2000 });
    await page.goto(url); await confirm(page, "Cancelar sorteio");
    await expect(page.getByRole("status")).toHaveText("Sorteio cancelado. As reservas deste sorteio também foram canceladas.");
    await c.goto(resultUrl); await expect(c.getByText("O grupo está sem sorteio.", { exact: true })).toBeVisible();
    await c.goto(url); await confirm(c, "Sair do grupo");
    await expect(c).toHaveURL(/\/grupos\?status=saida$/);
    await page.goto(`${other}/listas/${targetId}`); await expect(page.getByText("Reservado neste grupo", { exact: true })).toBeVisible();
  } finally { await bContext.close(); await cContext.close(); }
});
