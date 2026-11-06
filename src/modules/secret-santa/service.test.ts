import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSecretSantaService } from "./service";
import type { DrawRepository, DrawUnit } from "./types";
vi.mock("server-only", () => ({}));
const a = "000000000000000000000001", b = "000000000000000000000002", c = "000000000000000000000003";
const id = "000000000000000000000004", old = "000000000000000000000005", fresh = "000000000000000000000006";
const group = { id, name: "Natal", type: "secret_santa" as const, adminId: a, memberCount: 3, membershipVersion: 3, activeDrawId: null as string | null, drawRevision: 0 };
const expected = { revision: 0, compositionVersion: 3 };
const unit = { getGroup: vi.fn(), lockGroup: vi.fn(), isMember: vi.fn(), members: vi.fn(), invalidate: vi.fn(), cancelReservations: vi.fn(), insertDraw: vi.fn(), insertAssignments: vi.fn(), publish: vi.fn() } satisfies DrawUnit;
const repository: DrawRepository = { transaction: async (work) => work(unit) };
const generate = vi.fn();
const service = createSecretSantaService(repository, generate);
beforeEach(() => {
  vi.resetAllMocks(); unit.getGroup.mockResolvedValue({ ...group, assignments: ["never-public"] }); unit.lockGroup.mockResolvedValue(group);
  unit.isMember.mockResolvedValue(true); unit.members.mockResolvedValue([a, b, c]); unit.invalidate.mockResolvedValue(true); unit.insertDraw.mockResolvedValue(fresh);
  generate.mockReturnValue([{ giverId: a, recipientId: b }, { giverId: b, recipientId: c }, { giverId: c, recipientId: a }]);
});
describe("regras de sorteio", () => {
  it("status não publica IDs de edição, atribuições ou contador de reservas", async () => {
    expect(await service.status(a, id)).toEqual({ hasActiveDraw: false, revision: 0, compositionVersion: 3, memberCount: 3 });
    expect(unit.lockGroup).not.toHaveBeenCalled();
  });
  it("inicia com snapshot completo e publica sem retornar atribuições", async () => {
    expect(await service.execute(a, id, "start", expected)).toBeUndefined();
    expect(generate).toHaveBeenCalledWith([a, b, c]);
    expect(unit.insertDraw).toHaveBeenCalledWith(id, 3, a, expect.any(Date));
    expect(unit.insertAssignments).toHaveBeenCalledWith(fresh, generate.mock.results[0].value);
    expect(unit.publish).toHaveBeenCalledWith(id, fresh, expect.any(Date));
  });
  it.each(["start", "redraw", "invalidate"] as const)("somente admin pode executar %s", async (operation) => {
    await expect(service.execute(b, id, operation, expected)).rejects.toMatchObject({ code: "forbidden" });
    expect(unit.insertDraw).not.toHaveBeenCalled(); expect(unit.invalidate).not.toHaveBeenCalled();
  });
  it("mínimo é três, mesmo em chamada direta", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, memberCount: 2 }); unit.members.mockResolvedValue([a, b]);
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "insufficient" });
    expect(generate).not.toHaveBeenCalled();
  });
  it("composição divergente ou duplicada falha fechada", async () => {
    unit.members.mockResolvedValue([a, b]);
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "inconsistent" });
    unit.members.mockResolvedValue([a, a, b]);
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "inconsistent" });
  });
  it("resultado inválido do gerador não pode ser persistido", async () => {
    generate.mockReturnValue([{ giverId: a, recipientId: a }, { giverId: b, recipientId: c }, { giverId: c, recipientId: b }]);
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "inconsistent" });
    expect(unit.insertDraw).not.toHaveBeenCalled(); expect(unit.insertAssignments).not.toHaveBeenCalled();
  });
  it("grupo convencional não sorteia", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, type: "conventional" });
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "invalid" });
  });
  it("start não substitui um sorteio ativo", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, activeDrawId: old });
    await expect(service.execute(a, id, "start", expected)).rejects.toMatchObject({ code: "state" });
  });
  it.each(["redraw", "invalidate"] as const)("%s exige edição ativa", async (operation) => {
    await expect(service.execute(a, id, operation, expected)).rejects.toMatchObject({ code: "state" });
  });
  it("refaz invalidando e cancelando antes de publicar nova edição", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, activeDrawId: old });
    await service.execute(a, id, "redraw", expected);
    expect(unit.invalidate).toHaveBeenCalledWith(id, old, expect.any(Date));
    expect(unit.cancelReservations).toHaveBeenCalledWith(id, old);
    expect(unit.cancelReservations.mock.invocationCallOrder[0]).toBeLessThan(unit.insertDraw.mock.invocationCallOrder[0]);
    expect(unit.publish).toHaveBeenCalledWith(id, fresh, expect.any(Date));
  });
  it("invalida sem gerar outro resultado", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, activeDrawId: old });
    await service.execute(a, id, "invalidate", expected);
    expect(unit.publish).toHaveBeenCalledWith(id, null, expect.any(Date));
    expect(unit.insertDraw).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
  });
  it("edição inconsistente não cancela reservas nem publica ponteiro", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, activeDrawId: old }); unit.invalidate.mockResolvedValue(false);
    await expect(service.execute(a, id, "invalidate", expected)).rejects.toMatchObject({ code: "inconsistent" });
    expect(unit.cancelReservations).not.toHaveBeenCalled(); expect(unit.publish).not.toHaveBeenCalled();
  });
  it.each([{ revision: 1, compositionVersion: 3 }, { revision: 0, compositionVersion: 4 }])("rejeita formulário antigo %o", async (snapshot) => {
    await expect(service.execute(a, id, "start", snapshot)).rejects.toMatchObject({ code: "stale" });
    expect(unit.insertDraw).not.toHaveBeenCalled();
  });
  it("nega não membros sem revelar estado", async () => {
    unit.isMember.mockResolvedValue(false);
    await expect(service.status(c, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.execute(c, id, "start", expected)).rejects.toMatchObject({ code: "not_found" });
  });
  it("valida identidade, IDs, operação e revisão antes da persistência", async () => {
    await expect(service.execute(null, id, "start", expected)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(service.status(a, "bad")).rejects.toMatchObject({ code: "not_found" });
    await expect(service.execute(a, id, "unknown", expected)).rejects.toMatchObject({ code: "invalid" });
    await expect(service.execute(a, id, "start", { revision: -1 })).rejects.toMatchObject({ code: "invalid" });
    expect(unit.lockGroup).not.toHaveBeenCalled();
  });
});
