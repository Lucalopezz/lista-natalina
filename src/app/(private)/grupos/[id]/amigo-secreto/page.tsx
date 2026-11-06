import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getReservationService } from "@/modules/reservations/server";
import { ReservationError } from "@/modules/reservations/service";
import { wishlistQuerySchema } from "@/modules/reservations/validation";
import { GroupGiftCard } from "@/modules/reservations/components/group-gift-card";
import { groupIdSchema } from "@/modules/groups/validation";
import type { SecretSantaView } from "@/modules/reservations/types";

export const metadata = { title: "Meu amigo secreto | Lista Natalina" };
type Query = { cursor?: string | string[]; status?: string | string[] };
export default async function SecretSantaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const user = await requireCurrentUser(), parsedId = groupIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const query = await searchParams, page = wishlistQuerySchema.safeParse({ cursor: query.cursor });
  const path = `/grupos/${parsedId.data}/amigo-secreto`;
  if (!page.success) redirect(path);
  let result: SecretSantaView;
  try { result = await (await getReservationService()).secretSanta(user.id, parsedId.data, page.data); }
  catch (error) { if (error instanceof ReservationError && error.code === "not_found") notFound(); throw error; }
  const group = result.state === "drawn" ? result.wishlist.group : result.group;
  const feedback = query.status === "reservado" ? "Presente reservado. O dono não vê esta informação."
    : query.status === "cancelado" ? "Reserva cancelada. O presente está disponível neste grupo." : null;
  return (
    <section className="py-8">
      <Link href={`/grupos/${group.id}`} className="inline-flex min-h-12 items-center py-3 underline underline-offset-4">← Voltar ao grupo</Link>
      <h1 className="mt-4 text-3xl font-bold">Meu amigo secreto</h1>
      <p className="mt-3 text-muted wrap-anywhere">Grupo: {group.name}</p>
      {result.state === "pending" ? <p className="mt-6 rounded-xl border border-line bg-field p-6">O grupo está sem sorteio.</p> : (
        <>
          <section aria-label="Pessoa sorteada" className="mt-6 rounded-xl border border-ink bg-soft p-5">
            <p className="text-base text-muted">Você vai presentear</p>
            <h2 className="mt-2 text-3xl font-bold wrap-anywhere">{result.wishlist.owner.name}</h2>
            <p className="mt-3 leading-relaxed">Este resultado é só seu. O administrador também não vê quem você tirou.</p>
          </section>
          <h2 className="mt-8 text-2xl font-bold">Lista de presentes</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">A reserva vale apenas neste grupo e não significa que o presente foi comprado. A pessoa sorteada não vê as reservas.</p>
          {feedback && <p role="status" className="mt-5 rounded-lg border border-ink bg-soft p-4">{feedback}</p>}
          {result.wishlist.gifts.length ? <div className="mt-6 grid gap-6 md:grid-cols-2">{result.wishlist.gifts.map((gift) => <GroupGiftCard key={gift.id} gift={gift} groupId={group.id} />)}</div> : <p className="mt-6 rounded-xl border border-line bg-field p-6">{query.cursor ? "Não há mais presentes nesta página." : "Esta pessoa ainda não adicionou presentes."}</p>}
          <nav aria-label="Páginas dos presentes do amigo secreto" className="mt-5 flex flex-wrap justify-between gap-3">
            {query.cursor && <Link href={path} className="min-h-12 py-3 underline underline-offset-4">Voltar aos primeiros presentes</Link>}
            {result.wishlist.nextCursor && <Link href={`${path}?cursor=${result.wishlist.nextCursor}`} className="ml-auto min-h-12 py-3 font-bold underline underline-offset-4">Ver mais presentes</Link>}
          </nav>
        </>
      )}
    </section>
  );
}
