import { test, expect } from "./fixtures";

test("respostas protegem enquadramento, conteúdo e origem das operações", async ({ page, request }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("form-action 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["x-powered-by"]).toBeUndefined();
  const anonymous = await request.get("/presentes", { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()["location"]).toBe("/entrar");
  expect(anonymous.headers()["cache-control"]).toContain("no-store");
  const crossOrigin = await request.post("/api/auth/sign-in/email", {
    headers: { origin: "https://untrusted.example.test" }, data: { email: "nobody@example.test", password: "secret" },
  });
  expect(crossOrigin.status()).toBe(403);
  expect(crossOrigin.headers()["cache-control"]).toBe("no-store");
});

test("texto de presente não executa HTML e conteúdo privado não é cacheado", async ({ page, browser, baseURL }) => {
  const name = `Pessoa ${crypto.randomUUID()}`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(`security-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const profile = await page.goto("/perfil");
  expect(profile!.headers()["cache-control"]).toContain("no-store");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", "noindex, nofollow");
  const anonymous = await browser.newContext({ baseURL });
  try {
    const response = await anonymous.request.get("/perfil", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(await response.text()).not.toContain(name);
  } finally { await anonymous.close(); }
  await page.goto("/presentes/novo");
  const giftName = '<img src=x onerror="window.__wishlistXss=1">';
  const description = '<script>window.__wishlistXss=2</script>';
  await page.getByLabel("Nome do presente").fill(giftName);
  await page.getByLabel("Descrição", { exact: true }).fill(description);
  await page.getByLabel("Link do produto").fill("https://example.test/produto");
  await page.getByRole("button", { name: "Salvar presente", exact: true }).click();
  await expect(page.getByRole("heading", { name: giftName, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__wishlistXss"))).toBeUndefined();
});
