import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ connect: vi.fn(), close: vi.fn(), db: vi.fn() }));
vi.mock("mongodb", () => ({
  MongoClient: vi.fn(class {
    connect = mocks.connect;
    close = mocks.close;
    db = mocks.db;
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("__listaNatalinaMongo", undefined);
  vi.stubEnv("DATABASE_URL", "mongodb://localhost:27017/wishlist");
  vi.stubEnv("DATABASE_NAME", "wishlist");
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.db.mockReset().mockReturnValue({ name: "wishlist" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("conexão MongoDB", () => {
  it("não conecta nem exige ambiente durante importação", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await import("./mongodb");
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("compartilha conexão entre chamadas concorrentes e recarregamentos", async () => {
    const { getMongoClient, getDatabase } = await import("./mongodb");
    const [first, second] = await Promise.all([getMongoClient(), getMongoClient()]);
    expect(first).toBe(second);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    await getDatabase();
    expect(mocks.db).toHaveBeenCalledWith("wishlist");
    vi.resetModules();
    expect(await (await import("./mongodb")).getMongoClient()).toBe(first);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it("limpa conexão que falhou e permite nova tentativa", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("connection failed"));
    const { getMongoClient } = await import("./mongodb");
    await expect(getMongoClient()).rejects.toThrow("connection failed");
    expect(mocks.close).toHaveBeenCalledTimes(1);
    await expect(getMongoClient()).resolves.toBeDefined();
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it("limita pool por instância sem manter conexões mínimas", async () => {
    const { getMongoClient } = await import("./mongodb");
    await getMongoClient();
    const { MongoClient } = await import("mongodb");
    expect(MongoClient).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 5000,
    }));
  });
});
