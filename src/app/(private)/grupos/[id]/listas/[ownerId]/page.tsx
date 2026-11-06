import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getReservationService } from "@/modules/reservations/server";
import { ReservationError } from "@/modules/reservations/service";
import { wishlistPathSchema, wishlistQuerySchema } from "@/modules/reservations/validation";
import { GroupGiftCard } from "@/modules/reservations/components/group-gift-card";
import type { WishlistView } from "@/modules/reservations/types";

export const metadata = { title: "Lista de presentes do participante | Lista Natalina" };
type Query = { cursor?: string | string[]; status?: string | string[] };
export default async function GroupWishlistPage({ params, searchParams }: { params: Promise<{ id: string; ownerId: string }>; searchParams: Promise<Query> }) {
  const user = await requireCurrentUser();
  const { id, ownerId } = await params;
  const path = wishlistPathSchema.safeParse({ groupId: id, ownerId });
  if (!path.success) notFound();
  const query = await searchParams;
  const page = wishlistQuerySchema.safeParse({ cursor: query.cursor });
  const listPath = `/grupos/${path.data.groupId}/listas/${path.data.ownerId}`;
  if (!page.success) redirect(listPath);
  let result: WishlistView;
  try { result = await (await getReservationService()).list(user.id, path.data.groupId, path.data.ownerId, page.data); }
  catch (error) { if (error instanceof ReservationError && error.code === "not_found") notFound(); throw error; }
  const own = user.id === result.owner.id;
  const feedback = !own && query.status === "reservado" ? "Presente reservado. O dono não vê esta informação."
    : !own && query.status === "cancelado" ? "Reserva cancelada. O presente está disponível neste grupo." : null;
  return (
    <section className="py-8">
      <Link href={`/grupos/${result.group.id}`} className="inline-flex min-h-12 items-center py-3 underline underline-offset-4">← Voltar ao grupo</Link>
      <h1 className="mt-4 text-3xl font-bold wrap-anywhere">Lista de presentes de {result.owner.name}</h1>
      <p className="mt-3 leading-relaxed text-muted wrap-anywhere">Grupo: {result.group.name}</p>
      {own ? <Link href="/presentes" className="mt-4 inline-flex min-h-12 items-center rounded-lg border border-ink px-4 py-3 font-bold underline underline-offset-4">Gerenciar minha lista</Link>
        : <p className="mt-4 max-w-2xl leading-relaxed text-muted">As reservas valem apenas para este grupo. Reservar não significa que o presente já foi comprado. O dono não vê as reservas.</p>}
      {feedback && <p role="status" className="mt-6 rounded-lg border border-ink bg-soft p-4">{feedback}</p>}
      {result.gifts.length ? <div className="mt-6 grid gap-6 md:grid-cols-2">{result.gifts.map((gift) => <GroupGiftCard key={gift.id} gift={gift} groupId={result.group.id} />)}</div>
        : <p className="mt-6 rounded-xl border border-line bg-field p-6">{query.cursor ? "Não há mais presentes nesta página." : "Esta pessoa ainda não adicionou presentes."}</p>}
      <nav aria-label="Páginas da lista do participante" className="mt-6 flex flex-wrap justify-between gap-4">
        {query.cursor && <Link href={listPath} className="min-h-12 py-3 underline underline-offset-4">Voltar aos primeiros presentes</Link>}
        {result.nextCursor && <Link href={`${listPath}?cursor=${result.nextCursor}`} className="ml-auto min-h-12 py-3 font-bold underline underline-offset-4">Ver mais presentes</Link>}
      </nav>
    </section>
  );
}
