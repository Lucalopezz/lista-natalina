import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { groupPageSchema } from "@/modules/groups/validation";
import { SecretSantaCard } from "@/modules/secret-santa/components/result-card";
export const metadata = { title: "Meus amigos secretos | Lista Natalina" };
export default async function DrawnGroupsPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  const user = await requireCurrentUser(), query = await searchParams;
  const parsed = groupPageSchema.safeParse({ cursor: query.cursor });
  if (!parsed.success) redirect("/amigos-secretos");
  const page = await (await getGroupService()).drawnGroups(user.id, parsed.data);
  return <section className="py-8"><h1 className="text-3xl font-bold">Meus amigos secretos</h1><p className="mt-3 text-muted">Grupos com sorteio ativo. Cada resultado é visível apenas para você.</p>{page.items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{page.items.map((group) => <SecretSantaCard key={group.id} group={group} />)}</div> : <p className="mt-6 rounded-xl border border-line bg-field p-6">Você não tem grupos com sorteio ativo nesta página.</p>}<nav aria-label="Páginas dos amigos secretos" className="mt-5 flex flex-wrap justify-between gap-3">{query.cursor && <Link href="/amigos-secretos" className="min-h-12 py-3 underline underline-offset-4">Voltar ao início</Link>}{page.nextCursor && <Link href={`/amigos-secretos?cursor=${page.nextCursor}`} className="ml-auto min-h-12 py-3 font-bold underline underline-offset-4">Ver mais grupos</Link>}</nav></section>;
}
