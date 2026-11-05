import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureAuthIndexes } from "./indexes";
import { createAuth } from "./config";
import { createAuthHttpHandler } from "./http";

vi.mock("server-only", () => ({}));
const uri = process.env.INTEGRATION_DATABASE_URL ?? "";
// Este teste só aceita o MongoDB temporário criado pelo script, nunca DATABASE_URL.
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/lista_natalina_test\?directConnection=true$/.test(uri)) {
  throw new Error("Execute pnpm test:integration para criar um banco descartável isolado.");
}
const client = new MongoClient(uri);
const db = client.db();
const origin = "http://localhost:3000";
let handler: ReturnType<typeof createAuthHttpHandler>;
const account = { name: "Ana Silva", email: "ana@example.test", password: "secret" };
let cookie = "";
let userId = "";
function request(path: string, body?: unknown, headers: Record<string, string> = {}, handle = handler) {
  return handle(new Request(`${origin}/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

beforeAll(async () => {
  await client.connect();
  await ensureAuthIndexes(db);
  handler = createAuthHttpHandler(createAuth(db, client, {
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "only-for-isolated-integration-tests-not-a-real-secret",
  }));
}, 20_000);
afterAll(async () => { await db.dropDatabase(); await client.close(); });

describe("autenticação HTTP com MongoDB real", () => {
  it("nega sessão anônima sem expor qualquer informação", async () => {
    const response = await request("get-session");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Entre na sua conta para continuar." });
  });
  it("rejeita cadastro inválido no servidor", async () => {
    const response = await request("sign-up/email", { ...account, password: "short" });
    expect(response.status).toBe(400);
    expect(await db.collection("user").countDocuments()).toBe(0);
  });
  it("recusa requisição de outra origem", async () => {
    expect((await request("sign-up/email", account, { origin: "https://untrusted.test" })).status).toBe(403);
  });
  it("cadastra, persiste hash seguro e emite cookie HttpOnly de sessão", async () => {
    const response = await request("sign-up/email", { ...account, name: " Ana Silva ", email: " ANA@EXAMPLE.TEST " });
    expect(response.status).toBe(200);
    const data = await response.json();
    userId = data.user.id;
    expect(data).toEqual({ user: { id: expect.any(String), name: "Ana Silva", email: "ana@example.test" } });
    const cookies = response.headers.getSetCookie();
    expect(cookies.join(";")).toMatch(/HttpOnly/i);
    expect(cookies.join(";")).toMatch(/SameSite=Lax/i);
    cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    const credential = await db.collection("account").findOne({ userId: new ObjectId(userId) });
    expect(credential?.password).toBeTruthy();
    expect(credential?.password).not.toBe(account.password);
    const session = await db.collection("session").findOne({ userId: new ObjectId(userId) });
    const duration = session!.expiresAt.getTime() - session!.createdAt.getTime();
    expect(duration).toBeCloseTo(7 * 86400 * 1000, -3);
  });
  it("recusa email duplicado normalizado", async () => {
    const response = await request("sign-up/email", { ...account, email: "ANA@example.test" });
    expect(response.status).toBe(409);
    expect(await db.collection("user").countDocuments({ email: account.email })).toBe(1);
  });
  it("retorna somente perfil próprio a partir da identidade da sessão", async () => {
    const response = await request("get-session", undefined, { cookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: { id: userId, name: account.name, email: account.email } });
  });
  it("logout revoga sessão no banco, mesmo reutilizando o cookie antigo", async () => {
    expect((await request("sign-out", {}, { cookie })).status).toBe(200);
    expect((await request("get-session", undefined, { cookie })).status).toBe(401);
  });
  it("credenciais inexistentes e senha incorreta usam a mesma mensagem", async () => {
    const invalid = await request("sign-in/email", { email: account.email, password: "incorrect" });
    const missing = await request("sign-in/email", { email: "unknown@example.test", password: "incorrect" });
    expect(invalid.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await invalid.json()).toEqual(await missing.json());
  });
  it("login válido funciona sem confirmação de email", async () => {
    // Limpa somente contadores do banco temporário para isolar este cenário do anterior.
    await db.collection("rateLimit").deleteMany({});
    const response = await request("sign-in/email", { email: account.email, password: account.password });
    expect(response.status).toBe(200);
    cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    expect((await request("get-session", undefined, { cookie })).status).toBe(200);
  });
  it("sessão expirada e cookie adulterado não autorizam acesso", async () => {
    await db.collection("session").updateMany({}, { $set: { expiresAt: new Date(0) } });
    expect((await request("get-session", undefined, { cookie })).status).toBe(401);
    expect((await request("get-session", undefined, { cookie: "better-auth.session_token=forged" })).status).toBe(401);
  });
  it("cadastros concorrentes deixam somente um usuário/credencial por email", async () => {
    const body = { ...account, email: "concurrent@example.test" };
    const responses = await Promise.all([request("sign-up/email", body), request("sign-up/email", body)]);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.every((r) => [200, 409, 422].includes(r.status))).toBe(true);
    expect(await db.collection("user").countDocuments({ email: body.email })).toBe(1);
    const user = await db.collection("user").findOne({ email: body.email });
    expect(await db.collection("account").countDocuments({ userId: user!._id })).toBe(1);
  });
  it("compartilha limites persistidos entre instâncias e retorna 429", async () => {
    await db.collection("rateLimit").deleteMany({});
    const secondInstance = createAuthHttpHandler(createAuth(db, client, {
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: "only-for-isolated-integration-tests-not-a-real-secret",
    }));
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await request("sign-in/email", { email: account.email, password: "wrong-password" }, {}, attempt % 2 ? secondInstance : handler)).status);
    }
    expect(statuses.at(-1)).toBe(429);
    expect(await db.collection("rateLimit").countDocuments()).toBeGreaterThan(0);
  });
  it("usa cookies Secure na origem HTTPS de produção", async () => {
    const productionOrigin = "https://presentes.example.test";
    const secureHandler = createAuthHttpHandler(createAuth(db, client, {
      BETTER_AUTH_URL: productionOrigin,
      BETTER_AUTH_SECRET: "only-for-isolated-integration-tests-not-a-real-secret",
    }));
    const response = await secureHandler(new Request(`${productionOrigin}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: productionOrigin, "content-type": "application/json" },
      body: JSON.stringify({ ...account, email: "secure-cookie@example.test" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(";")).toMatch(/; Secure/i);
  });
  it("não disponibiliza recuperação, confirmação ou endpoints de edição fora do escopo", async () => {
    expect((await request("request-password-reset", { email: account.email })).status).toBe(404);
    expect((await request("update-user", { name: "Other" }, { cookie })).status).toBe(404);
  });
});
