import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { GroupError } from "@/modules/groups/service";
import { candidateQuerySchema, groupPageSchema } from "@/modules/groups/validation";
import { GroupOperationButton } from "@/modules/groups/components/group-operation-button";
import type { GroupView, Member, Page } from "@/modules/groups/types";

export const metadata = { title: "Grupo | Lista Natalina" };
const feedback: Record<string, string> = { criado: "Grupo criado.", atualizado: "Grupo atualizado.", participante_adicionado: "Participante adicionado.", participante_removido: "Participante removido.", administracao_transferida: "Administração transferida." };
type Query = { q?: string | string[]; membersCursor?: string | string[]; searchCursor?: string | string[]; status?: string | string[] };
export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const query = await searchParams;
  const memberPage = groupPageSchema.safeParse({ cursor: query.membersCursor });
  if (!memberPage.success) redirect(`/grupos/${id}`);
  const service = await getGroupService();
  let detail: { group: GroupView; members: Page<Member> };
  try { detail = await service.get(user.id, id, memberPage.data); }
  catch (error) { if (error instanceof GroupError && error.code === "not_found") notFound(); throw error; }
  const { group, members } = detail;
  const isAdmin = group.adminId === user.id;
  const search = candidateQuerySchema.safeParse({ q: query.q ?? "", cursor: query.searchCursor });
  let candidates: Page<Member> = { items: [], nextCursor: null };
  // A condição só controla apresentação. service.search também exige admin no backend.
  if (isAdmin && !group.hasActiveDraw && search.success && search.data.q) candidates = await service.search(user.id, group.id, search.data);
  const status = typeof query.status === "string" && Object.hasOwn(feedback, query.status) ? feedback[query.status] : null;
  return (
    <section className="py-10 md:py-12">
      <Link href="/grupos" className="inline-block py-3 text-sm text-muted underline underline-offset-4">← Meus grupos</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-accent">{group.type === "conventional" ? "Convencional" : "Amigo secreto"}</p><h1 className="mt-3 font-display text-4xl tracking-tight wrap-anywhere md:text-5xl">{group.name}</h1><p className="mt-4 text-sm text-muted">{group.memberCount} {group.memberCount === 1 ? "participante" : "participantes"}</p></div>{isAdmin && <Link href={`/grupos/${group.id}/editar`} className="py-3 text-sm text-accent underline underline-offset-4">Editar grupo</Link>}</div>
      {group.description && <p className="mt-5 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-muted wrap-anywhere">{group.description}</p>}
      <p className="mt-4 text-sm font-bold">{isAdmin ? "Você administra este grupo." : "Você participa deste grupo."}</p>
      {status && <p role="status" className="mt-6 rounded-xl bg-soft p-4 text-sm">{status}</p>}
      {group.hasActiveDraw && <p className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-relaxed">O sorteio está ativo. Adição, remoção e saída de participantes estão bloqueadas até o administrador invalidar o sorteio. A transferência de administração continua permitida.</p>}
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="members-title"><h2 id="members-title" className="font-display text-2xl">Participantes</h2>
          <ul aria-label="Participantes" className="mt-5 divide-y divide-line rounded-xl border border-line bg-field px-5">
            {members.items.map((member) => <li key={member.id} className="py-4"><p className="font-bold wrap-anywhere">{member.name}{member.id === user.id ? " (você)" : ""}</p><p className="mt-1 text-xs text-muted">{member.id === group.adminId ? "Administrador" : "Participante"}</p>{isAdmin && member.id !== user.id && <div className="mt-2 flex flex-wrap gap-x-5"><GroupOperationButton operation="transfer" groupId={group.id} participantId={member.id} participantName={member.name} />{!group.hasActiveDraw && <GroupOperationButton operation="remove" groupId={group.id} participantId={member.id} participantName={member.name} />}</div>}</li>)}
          </ul>
          <nav aria-label="Páginas de participantes" className="mt-3 flex flex-wrap justify-between gap-3">{query.membersCursor && <Link href={`/grupos/${group.id}`} className="py-3 text-sm underline underline-offset-4">Primeiros participantes</Link>}{members.nextCursor && <Link href={`/grupos/${group.id}?membersCursor=${members.nextCursor}`} className="ml-auto py-3 text-sm text-accent underline underline-offset-4">Mais participantes →</Link>}</nav>
        </section>
        {isAdmin && !group.hasActiveDraw && <section aria-labelledby="search-title"><h2 id="search-title" className="font-display text-2xl">Adicionar participantes</h2><p className="mt-3 text-sm leading-relaxed text-muted">Pesquise pessoas cadastradas. Ao adicionar, elas já passam a participar do grupo.</p>
          <form action={`/grupos/${group.id}`} method="get" className="mt-5 grid gap-3"><label htmlFor="member-search" className="text-sm font-bold">Pesquisar usuários pelo nome</label><div className="flex flex-wrap gap-3"><input id="member-search" name="q" type="search" defaultValue={typeof query.q === "string" ? query.q : ""} maxLength={100} className="min-h-12 min-w-0 flex-1 rounded-lg border border-[#8c998d] bg-field p-3 text-base" /><button type="submit" className="min-h-12 rounded-lg bg-accent px-5 py-3 text-sm text-white">Pesquisar</button></div></form>
          {!search.success && <p className="mt-4 text-sm text-error" role="alert">Use até 100 caracteres e uma página válida para pesquisar.</p>}
          {search.success && search.data.q && (candidates.items.length ? <ul aria-label="Resultados da pesquisa" className="mt-5 divide-y divide-line rounded-xl border border-line bg-field px-5">{candidates.items.map((candidate) => <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="min-w-0 font-bold wrap-anywhere">{candidate.name}</p><GroupOperationButton operation="add" groupId={group.id} participantId={candidate.id} participantName={candidate.name} /></li>)}</ul> : <p className="mt-5 text-sm text-muted">Nenhum usuário fora do grupo encontrado com esse início de nome.</p>)}
          {candidates.nextCursor && search.success && <Link href={`/grupos/${group.id}?q=${encodeURIComponent(search.data.q)}&searchCursor=${candidates.nextCursor}`} className="mt-3 inline-block py-3 text-sm text-accent underline underline-offset-4">Mais resultados →</Link>}
        </section>}
      </div>
      {!group.hasActiveDraw && <div className="mt-10 border-t border-line pt-5">{isAdmin ? group.memberCount === 1 ? <GroupOperationButton operation="close" groupId={group.id} /> : <p className="text-sm leading-relaxed text-muted">Para sair, transfira a administração para outro participante.</p> : <GroupOperationButton operation="leave" groupId={group.id} />}</div>}
    </section>
  );
}
