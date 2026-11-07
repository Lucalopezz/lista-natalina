import { test, expect } from "./fixtures";

test("pesquisa enquanto digita nome do meio, sem acento ou com erro, e adiciona a pessoa", async ({ page, browser, baseURL }) => {
  const member = await browser.newContext({ baseURL });
  try {
    const signup = async (target: typeof page, name: string) => {
      await target.goto("/cadastro");
      await target.getByLabel("Seu nome").fill(name);
      await target.getByLabel("Email", { exact: true }).fill(`people-${crypto.randomUUID()}@example.test`);
      await target.getByLabel("Senha", { exact: true }).fill("secret");
      await target.getByRole("button", { name: "Criar minha conta" }).click();
      await expect(target).toHaveURL(/\/dashboard$/);
    };
    const memberPage = await member.newPage();
    const memberName = `José Aparecida ${crypto.randomUUID().slice(0, 8)}`;
    await signup(memberPage, memberName);
    await signup(page, "Administrador da pesquisa");
    await page.goto("/grupos/novo");
    await page.getByLabel("Nome do grupo").fill("Busca interativa");
    await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
    await expect(page).toHaveURL(/\/grupos\/[a-f\d]{24}\?status=criado$/);
    const groupId = new URL(page.url()).pathname.split("/").at(-1)!;
    const panel = page.getByRole("region", { name: "Adicionar pessoas" });
    const search = page.getByLabel("Pesquisar pessoas pelo nome");
    const results = page.getByRole("list", { name: "Resultados da pesquisa" });
    for (const query of ["aparec", "jose", "aparc", "aparc "]) {
      const response = page.waitForResponse((response) => new URL(response.url()).searchParams.get("q") === query.trim());
      await search.fill(query);
      await response;
      await expect(results.getByText(memberName, { exact: true })).toBeVisible();
    }

    // Atrasamos uma resposta antiga, mesmo depois de o navegador abortar o fetch.
    // Ela não pode substituir os resultados do texto mais recente.
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
    await page.route(`**/api/grupos/${groupId}/pessoas?**`, async (route) => {
      const q = new URL(route.request().url()).searchParams.get("q");
      if (q === "antiga") {
        await oldGate;
        await route.fulfill({ json: { items: [{ id: "000000000000000000000001", name: "Resposta antiga" }], nextCursor: null } });
      } else await route.continue();
    });
    const oldRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get("q") === "antiga");
    await search.fill("antiga"); await oldRequest;
    await search.fill("aparec");
    await expect(results.getByText(memberName, { exact: true })).toBeVisible();
    releaseOld();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByText("Resposta antiga", { exact: true })).toHaveCount(0);

    // Paginação preserva resultados, permite repetir uma página que falhou e
    // não duplica pessoas presentes em ambas as respostas.
    let failMore = true;
    const firstPerson = { id: "000000000000000000000011", name: "Primeira pessoa" };
    const nextPerson = { id: "000000000000000000000012", name: "Segunda pessoa" };
    await page.route(`**/api/grupos/${groupId}/pessoas?**`, (route) => {
      const cursor = new URL(route.request().url()).searchParams.get("cursor");
      if (!cursor) return route.fulfill({ json: { items: [firstPerson], nextCursor: `0:${firstPerson.id}` } });
      if (failMore) { failMore = false; return route.fulfill({ status: 503, json: { message: "Tente carregar novamente." } }); }
      return route.fulfill({ json: { items: [firstPerson, nextPerson], nextCursor: null } });
    });
    await search.fill("paginas");
    await expect(results.getByText(firstPerson.name, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver mais resultados", exact: true }).click();
    await expect(panel.getByRole("alert")).toHaveText("Tente carregar novamente.");
    await page.getByRole("button", { name: "Ver mais resultados", exact: true }).click();
    await expect(results.getByRole("listitem")).toHaveCount(2);
    await expect(results.getByText(nextPerson.name, { exact: true })).toBeVisible();
    await page.unrouteAll();

    await page.route(`**/api/grupos/${groupId}/pessoas?**`, (route) => route.fulfill({ status: 503, json: { message: "Não foi possível pesquisar agora. Tente novamente." } }));
    await search.fill("erro");
    await expect(panel.getByRole("alert")).toHaveText("Não foi possível pesquisar agora. Tente novamente.");
    await page.unrouteAll();
    await search.fill("aparec");
    const candidate = results.getByRole("listitem").filter({ hasText: memberName });
    await expect(candidate).toBeVisible();
    await page.getByRole("button", { name: "Limpar pesquisa", exact: true }).click();
    await expect(search).toHaveValue(""); await expect(search).toBeFocused();
    await expect(results).toHaveCount(0);
    await search.fill("aparc");
    await candidate.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect(page.getByRole("list", { name: "Participantes" }).getByText(memberName, { exact: true })).toBeVisible();
    const forbidden = await memberPage.request.get(`/api/grupos/${groupId}/pessoas?q=aparec`);
    expect(forbidden.status()).toBe(403);
    expect(forbidden.headers()["cache-control"]).toContain("no-store");
  } finally { await member.close(); }
});
