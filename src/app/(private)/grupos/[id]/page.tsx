import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { getSecretSantaService } from "@/modules/secret-santa/server";
import { DrawControls } from "@/modules/secret-santa/components/draw-controls";
import { GroupError } from "@/modules/groups/service";
import { candidateQuerySchema, groupPageSchema } from "@/modules/groups/validation";
import { GroupOperationButton } from "@/modules/groups/components/group-operation-button";
import type { GroupView, Member, Page } from "@/modules/groups/types";

export const metadata = { title: "Grupo | Lista Natalina" };
const feedback: Record<string, string> = { criado: "Grupo criado.", atualizado: "Grupo atualizado.", participante_adicionado: "Participante adicionado.", participante_removido: "Participante removido.", administracao_transferida: "Administração transferida.", sorteado: "Sorteio realizado. Cada pessoa já pode consultar seu amigo secreto.", sorteio_refeito: "Sorteio refeito. Consulte seu novo resultado.", sorteio_cancelado: "Sorteio cancelado. As reservas deste sorteio também foram canceladas." };
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
  const drawStatus = group.type === "secret_santa" ? await (await getSecretSantaService()).status(user.id, group.id) : null;
  const search = candidateQuerySchema.safeParse({ q: query.q ?? "", cursor: query.searchCursor });
  let candidates: Page<Member> = { items: [], nextCursor: null };
  // A condição só controla apresentação. service.search também exige admin no backend.
  if (isAdmin && !group.hasActiveDraw && search.success && search.data.q) candidates = await service.search(user.id, group.id, search.data);
  const status = typeof query.status === "string" && Object.hasOwn(feedback, query.status) ? feedback[query.status] : null;
  return (
    <section className="max-w-3xl py-8">
      <Link href="/grupos" className="inline-flex min-h-12 items-center py-3 text-base underline underline-offset-4">← Voltar aos meus grupos</Link>
      <h1 className="mt-4 text-3xl font-bold wrap-anywhere">{group.name}</h1>
      <p className="mt-3 text-base text-muted">{group.type === "conventional" ? "Lista em grupo" : "Amigo secreto"} · {group.memberCount} {group.memberCount === 1 ? "participante" : "participantes"}</p>
      {group.description && <p className="mt-4 leading-relaxed whitespace-pre-line wrap-anywhere">{group.description}</p>}
      <p className="mt-4 font-bold">{isAdmin ? "Você administra este grupo." : "Você participa deste grupo."}</p>
      {isAdmin && <Link href={`/grupos/${group.id}/editar`} className="mt-3 inline-flex min-h-12 items-center rounded-lg border border-ink px-4 py-3 text-base underline underline-offset-4">Editar grupo</Link>}
      {status && <p role="status" className="mt-6 rounded-lg border border-ink bg-soft p-4">{status}</p>}
      {drawStatus?.hasActiveDraw && <Link href={`/grupos/${group.id}/amigo-secreto`} className="mt-5 flex min-h-12 items-center justify-center rounded-lg bg-ink px-5 py-3 font-bold text-white">Meu amigo secreto</Link>}
      {isAdmin && drawStatus && <DrawControls groupId={group.id} status={drawStatus} />}
      {group.hasActiveDraw && <p className="mt-6 rounded-lg border border-gold bg-field p-4 leading-relaxed">O sorteio já foi feito. Ninguém pode entrar ou sair do grupo agora. Para mudar os participantes, o administrador precisa cancelar o sorteio atual. A administração ainda pode ser transferida.</p>}

      {isAdmin && !group.hasActiveDraw && (
        <section aria-labelledby="search-title" className="mt-8 rounded-xl border border-line bg-field p-5 sm:p-6">
          <h2 id="search-title" className="text-2xl font-bold">Adicionar pessoas</h2>
          <p className="mt-3 leading-relaxed text-muted">A pessoa precisa ter uma conta. Digite o nome dela, pesquise e use “Adicionar”.</p>
          <form action={`/grupos/${group.id}`} method="get" className="mt-5 grid gap-3">
            <label htmlFor="member-search" className="font-bold">Pesquisar pessoas pelo nome</label>
            <input id="member-search" name="q" type="search" defaultValue={typeof query.q === "string" ? query.q : ""} maxLength={100} placeholder="Digite o começo do nome" className="min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base" />
            <button type="submit" className="min-h-12 rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 sm:justify-self-start">Pesquisar</button>
          </form>
          {!search.success && <p className="mt-4 text-error" role="alert">Use até 100 caracteres e uma página válida para pesquisar.</p>}
          {search.success && search.data.q && (candidates.items.length ? (
            <ul aria-label="Resultados da pesquisa" className="mt-5 divide-y divide-line">
              {candidates.items.map((candidate) => <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="min-w-0 font-bold wrap-anywhere">{candidate.name}</p><GroupOperationButton operation="add" groupId={group.id} participantId={candidate.id} participantName={candidate.name} /></li>)}
            </ul>
          ) : <p className="mt-5 leading-relaxed text-muted">Nenhuma pessoa encontrada. Confira o começo do nome. Pessoas que já estão no grupo não aparecem nesta pesquisa.</p>)}
          {candidates.nextCursor && search.success && <Link href={`/grupos/${group.id}?q=${encodeURIComponent(search.data.q)}&searchCursor=${candidates.nextCursor}`} className="mt-3 inline-flex min-h-12 items-center py-3 font-bold underline underline-offset-4">Ver mais resultados</Link>}
        </section>
      )}

      {group.type === "secret_santa" && !group.hasActiveDraw && <p className="mt-6 rounded-lg border border-line bg-field p-4 leading-relaxed">As listas de outras pessoas ficam fechadas até o sorteio. Depois, você verá apenas a lista da pessoa que tirar.</p>}
      <section aria-labelledby="members-title" className="mt-8">
        <h2 id="members-title" className="text-2xl font-bold">Quem está no grupo</h2>
        <ul aria-label="Participantes" className="mt-4 divide-y divide-line rounded-xl border border-line bg-field px-5">
          {members.items.map((member) => (
            <li key={member.id} className="py-5">
              <p className="font-bold wrap-anywhere">{member.name}{member.id === user.id ? " (você)" : ""}</p>
              <p className="mt-1 text-base text-muted">{member.id === group.adminId ? "Administrador do grupo" : "Participante"}</p>
              {(member.id === user.id || group.type === "conventional") && (
                <Link href={member.id === user.id ? "/presentes" : `/grupos/${group.id}/listas/${member.id}`} className="mt-3 inline-flex min-h-12 items-center rounded-lg border-2 border-ink px-4 py-3 text-base font-bold hover:bg-soft">{member.id === user.id ? "Ver minha lista" : "Ver lista de presentes"}</Link>
              )}
              {isAdmin && member.id !== user.id && (
                <details className="mt-3">
                  {/* Ações ocasionais ficam separadas da leitura da lista de pessoas.
                      Recolher controles não concede nem substitui autorização. */}
                  <summary className="min-h-12 cursor-pointer py-3 text-base underline underline-offset-4 wrap-anywhere">Opções para {member.name}</summary>
                  <div className="mt-2 grid gap-3 rounded-lg bg-soft p-4">
                    <p className="text-base leading-relaxed text-muted">Você pode passar a administração para esta pessoa{!group.hasActiveDraw ? " ou removê-la do grupo" : ""}. Toda mudança pede confirmação.</p>
                    <GroupOperationButton operation="transfer" groupId={group.id} participantId={member.id} participantName={member.name} />
                    {!group.hasActiveDraw && <GroupOperationButton operation="remove" groupId={group.id} participantId={member.id} participantName={member.name} />}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
        <nav aria-label="Páginas de participantes" className="mt-3 flex flex-wrap justify-between gap-3">
          {query.membersCursor && <Link href={`/grupos/${group.id}`} className="min-h-12 py-3 underline underline-offset-4">Voltar aos primeiros participantes</Link>}
          {members.nextCursor && <Link href={`/grupos/${group.id}?membersCursor=${members.nextCursor}`} className="ml-auto min-h-12 py-3 font-bold underline underline-offset-4">Ver mais participantes</Link>}
        </nav>
      </section>
      {!group.hasActiveDraw && <div className="mt-8 border-t border-line pt-6">{isAdmin ? group.memberCount === 1 ? <GroupOperationButton operation="close" groupId={group.id} /> : <p className="leading-relaxed text-muted">Quer sair? Primeiro escolha outro administrador em “Opções” abaixo do nome de uma pessoa do grupo.</p> : <GroupOperationButton operation="leave" groupId={group.id} />}</div>}
    </section>
  );
}
