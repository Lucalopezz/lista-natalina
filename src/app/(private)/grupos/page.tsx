import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { groupPageSchema } from "@/modules/groups/validation";
import { GroupCard } from "@/modules/groups/components/group-card";

export const metadata = { title: "Meus grupos | Lista Natalina" };
export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[]; status?: string | string[] }> }) {
  const user = await requireCurrentUser();
  const query = await searchParams;
  const parsed = groupPageSchema.safeParse({ cursor: query.cursor });
  if (!parsed.success) redirect("/grupos");
  const page = await (await getGroupService()).list(user.id, parsed.data);
  const message = query.status === "saida" ? "Você saiu do grupo." : query.status === "encerrado" ? "Grupo encerrado." : null;
  return (
    <section className="py-10 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-[11px] font-bold tracking-[2px] text-accent uppercase">Quem faz parte dos seus encontros</p><h1 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">Meus grupos.</h1></div><Link href="/grupos/novo" className="inline-flex min-h-12 items-center rounded-lg bg-accent px-5 py-3 text-sm text-white hover:bg-[#8e182d]">Criar grupo</Link></div>
      {message && <p role="status" className="mt-6 rounded-xl bg-soft p-4 text-sm">{message}</p>}
      {page.items.length ? <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{page.items.map((group) => <GroupCard key={group.id} group={group} />)}</div> : <div className="mt-8 rounded-2xl border border-dashed border-ink/25 bg-soft/50 p-10 text-center"><h2 className="font-display text-2xl">Bons encontros começam por aqui.</h2><p className="mt-3 text-sm leading-relaxed text-muted">Crie um grupo ou peça para um administrador adicionar você.</p></div>}
      <nav className="mt-8 flex flex-wrap justify-between gap-4" aria-label="Páginas dos grupos">{query.cursor && <Link href="/grupos" className="py-3 text-sm underline underline-offset-4">Voltar ao início</Link>}{page.nextCursor && <Link href={`/grupos?cursor=${page.nextCursor}`} className="ml-auto py-3 text-sm text-accent underline underline-offset-4">Ver mais grupos →</Link>}</nav>
    </section>
  );
}
