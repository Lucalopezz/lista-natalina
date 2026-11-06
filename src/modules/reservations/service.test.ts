import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReservationService } from "./service";
import type { ReservationRepository, ReservationUnit } from "./types";

const a = "000000000000000000000001", b = "000000000000000000000002", c = "000000000000000000000003";
const groupId = "000000000000000000000004", giftId = "000000000000000000000005", drawId = "000000000000000000000006";
const group = { id: groupId, name: "Família", type: "conventional" as const, membershipVersion: 3, activeDrawId: null as string | null };
const gift = { id: giftId, ownerId: b, name: "Livro", description: "Receitas", productUrl: "https://example.test/book", imageUrl: "", createdAt: new Date(), updatedAt: new Date() };
const unit = { getGroup: vi.fn(), lockGroup: vi.fn(), isMember: vi.fn(), recipient: vi.fn(), profile: vi.fn(), listGifts: vi.fn(), lockGift: vi.fn(), availability: vi.fn(), insert: vi.fn(), cancel: vi.fn() } satisfies ReservationUnit;
const repository: ReservationRepository = { transaction: async (work) => work(unit) };
const service = createReservationService(repository);
beforeEach(() => {
  vi.resetAllMocks();
  unit.getGroup.mockResolvedValue(group); unit.lockGroup.mockResolvedValue(group);
  unit.isMember.mockResolvedValue(true); unit.recipient.mockResolvedValue(b);
  unit.profile.mockResolvedValue({ id: b, name: "Bruna", email: "private@example.test" });
  unit.listGifts.mockResolvedValue({ gifts: [{ ...gift, reservedBy: "never-public" }], nextCursor: giftId });
  unit.lockGift.mockResolvedValue(gift); unit.availability.mockResolvedValue([]); unit.cancel.mockResolvedValue(true);
});

describe("listas e reservas por contexto", () => {
  it("convencional permite lista completa paginada com perfil mínimo", async () => {
    const result = await service.list(a, groupId, b);
    expect(result.owner).toEqual({ id: b, name: "Bruna" });
    expect(result.gifts[0]).toMatchObject({ name: "Livro", availability: "available", canCancel: false });
    expect(result.nextCursor).toBe(giftId);
    expect(JSON.stringify(result)).not.toContain("never-public");
    expect(unit.listGifts).toHaveBeenCalledWith(b, undefined);
  });
  it("dono não consulta nem recebe status, capacidade de cancelar ou identidade", async () => {
    unit.availability.mockResolvedValue([{ giftId, reservedBy: a }]);
    const result = await service.list(b, groupId, b);
    expect(Object.keys(result.gifts[0]).sort()).toEqual(["id", "ownerId", "name", "description", "productUrl", "imageUrl", "createdAt", "updatedAt"].sort());
    expect(unit.availability).not.toHaveBeenCalled();
  });
  it.each([a, c])("reserva aparece indisponível sem expor reservante %s", async (reservedBy) => {
    unit.availability.mockResolvedValue([{ giftId, reservedBy }]);
    const result = await service.list(a, groupId, b);
    expect(result.gifts[0]).toMatchObject({ availability: "reserved", canCancel: reservedBy === a });
    expect(result.gifts[0]).not.toHaveProperty("reservedBy");
    expect(result.gifts[0]).not.toHaveProperty("drawId");
  });
  it("nega lista de não membro, mesmo conhecendo IDs", async () => {
    unit.isMember.mockImplementation(async (_g, user) => user !== c);
    await expect(service.list(c, groupId, b)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.list(a, groupId, c)).rejects.toMatchObject({ code: "not_found" });
    expect(unit.listGifts).not.toHaveBeenCalled();
  });
  it("amigo secreto antes do sorteio não libera terceiros nem por outro contexto", async () => {
    unit.getGroup.mockResolvedValue({ ...group, type: "secret_santa" });
    await expect(service.list(a, groupId, b)).rejects.toMatchObject({ code: "not_found" });
    expect(unit.listGifts).not.toHaveBeenCalled();
    expect(unit.recipient).not.toHaveBeenCalled();
  });
  it("amigo secreto ativo permite apenas destinatário do próprio autor", async () => {
    unit.getGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId });
    const result = await service.list(a, groupId, b);
    expect(result.gifts).toHaveLength(1);
    expect(unit.recipient).toHaveBeenCalledWith(expect.objectContaining({ activeDrawId: drawId }), a);
    expect(unit.availability).toHaveBeenCalledWith(groupId, drawId, [giftId]);
    await expect(service.list(a, groupId, c)).rejects.toMatchObject({ code: "not_found" });
  });
  it("edição inválida/atribuição ausente nega acesso, inclusive administrador", async () => {
    unit.getGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId, adminId: a });
    unit.recipient.mockResolvedValue(null);
    await expect(service.list(a, groupId, b)).rejects.toMatchObject({ code: "not_found" });
  });
  it("lista própria é permitida em amigo secreto sem consultar resultado ou reservas", async () => {
    unit.getGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId });
    await service.list(b, groupId, b);
    expect(unit.recipient).not.toHaveBeenCalled(); expect(unit.availability).not.toHaveBeenCalled();
  });
  it("contexto só informa o destinatário da sessão e não a edição/atribuições", async () => {
    unit.getGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId, assignments: [c] });
    expect(await service.context(a, groupId)).toEqual({ recipientId: b });
    expect(unit.recipient).toHaveBeenCalledWith(expect.anything(), a);
  });
  it("reserva usa dono/autor/edição derivados no servidor e coordena os recursos", async () => {
    await service.reserve(a, groupId, b, giftId);
    expect(unit.lockGroup).toHaveBeenCalledWith(groupId); expect(unit.lockGift).toHaveBeenCalledWith(giftId);
    expect(unit.insert).toHaveBeenCalledWith({ groupId, giftId, ownerId: b, reservedBy: a, drawId: null, createdAt: expect.any(Date) });
  });
  it("nega reserva própria e presente que não pertence à lista solicitada", async () => {
    await expect(service.reserve(b, groupId, b, giftId)).rejects.toMatchObject({ code: "forbidden" });
    await expect(service.reserve(a, groupId, c, giftId)).rejects.toMatchObject({ code: "not_found" });
    expect(unit.insert).not.toHaveBeenCalled();
  });
  it("nega reserva por não membro ou sem atribuição", async () => {
    unit.isMember.mockResolvedValue(false);
    await expect(service.reserve(a, groupId, b, giftId)).rejects.toMatchObject({ code: "not_found" });
    unit.isMember.mockResolvedValue(true);
    unit.lockGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId });
    unit.recipient.mockResolvedValue(c);
    await expect(service.reserve(a, groupId, b, giftId)).rejects.toMatchObject({ code: "not_found" });
    expect(unit.insert).not.toHaveBeenCalled();
  });
  it("reserva em amigo secreto exige edição ativa e destinatário", async () => {
    unit.lockGroup.mockResolvedValue({ ...group, type: "secret_santa", activeDrawId: drawId });
    await service.reserve(a, groupId, b, giftId);
    expect(unit.insert).toHaveBeenCalledWith(expect.objectContaining({ drawId, reservedBy: a, ownerId: b }));
  });
  it("cancelamento exige reservante autenticado e mantém o contexto", async () => {
    await service.cancel(a, groupId, b, giftId);
    expect(unit.cancel).toHaveBeenCalledWith(groupId, null, giftId, a);
    unit.cancel.mockResolvedValue(false);
    await expect(service.cancel(c, groupId, b, giftId)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.cancel(b, groupId, b, giftId)).rejects.toMatchObject({ code: "forbidden" });
  });
  it.each(["list", "reserve", "cancel", "context"])("%s exige autenticação", async (operation) => {
    const promise = operation === "list" ? service.list(null, groupId, b) : operation === "context" ? service.context(null, groupId)
      : operation === "reserve" ? service.reserve(null, groupId, b, giftId) : service.cancel(null, groupId, b, giftId);
    await expect(promise).rejects.toMatchObject({ code: "unauthorized" });
    expect(unit.getGroup).not.toHaveBeenCalled(); expect(unit.lockGroup).not.toHaveBeenCalled();
  });
  it("valida IDs e cursor antes de persistência", async () => {
    await expect(service.list(a, "invalid", b)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.list(a, groupId, b, { cursor: "invalid" })).rejects.toMatchObject({ code: "invalid" });
    await expect(service.reserve(a, groupId, b, "bad")).rejects.toMatchObject({ code: "not_found" });
    expect(unit.getGroup).not.toHaveBeenCalled(); expect(unit.lockGroup).not.toHaveBeenCalled();
  });
  it("nega recurso/pessoa inexistente sem revelar dados", async () => {
    unit.profile.mockResolvedValue(null);
    await expect(service.list(a, groupId, b)).rejects.toMatchObject({ code: "not_found" });
    unit.lockGift.mockResolvedValue(null);
    await expect(service.reserve(a, groupId, b, giftId)).rejects.toMatchObject({ code: "not_found" });
  });
});
