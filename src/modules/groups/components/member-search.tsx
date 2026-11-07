"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { GroupOperationButton } from "./group-operation-button";
import type { Member, Page } from "../types";

const empty: Page<Member> = { items: [], nextCursor: null };
export function MemberSearch({ groupId, initialQuery = "" }: { groupId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(empty);
  const [cursor, setCursor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(initialQuery.trim().length >= 2);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), revision = useRef(0);
  const term = query.trim();

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController(), current = revision.current;
    let active = true;
    // Uma pausa de 300 ms evita disparar uma consulta por tecla. Abort libera
    // a espera no navegador; a revisão também ignora respostas antigas que já
    // estavam em trânsito quando a pessoa mudou o texto ou limpou o campo.
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, ...(cursor ? { cursor } : {}) });
        const response = await fetch(`/api/grupos/${groupId}/pessoas?${params}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!active || revision.current !== current) return;
        if (!response.ok) { setError(data.message ?? "Não foi possível pesquisar agora. Tente novamente."); return; }
        const page = data as Page<Member>;
        setResult((previous) => ({
          // Carregar mais mantém os botões anteriores, sem repetir pessoas caso
          // a composição do grupo tenha mudado entre uma página e outra.
          items: cursor ? [...new Map([...previous.items, ...page.items].map((person) => [person.id, person])).values()] : page.items,
          nextCursor: page.nextCursor,
        }));
      } catch {
        if (active && revision.current === current && !controller.signal.aborted) setError("Não foi possível pesquisar agora. Tente novamente.");
      } finally {
        if (active && revision.current === current) setPending(false);
      }
    }, cursor ? 0 : 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [groupId, query, cursor, retry]);

  function change(value: string) {
    revision.current++;
    setQuery(value); setCursor(null); setResult(empty); setError("");
    setPending(value.trim().length >= 2);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (term.length < 2) return;
    revision.current++; setCursor(null); setResult(empty); setError(""); setPending(true); setRetry((value) => value + 1);
  }
  const message = term.length < 2 ? "Digite pelo menos 2 letras para pesquisar."
    : pending ? "Buscando pessoas…" : error ? ""
    : result.items.length ? `${result.items.length} ${result.items.length === 1 ? "pessoa encontrada" : "pessoas encontradas"}${result.nextCursor ? ". Há mais resultados abaixo." : "."}`
    : "Nenhuma pessoa encontrada. Tente outra parte do nome. Quem já está no grupo não aparece aqui.";

  return (
    <section aria-labelledby="search-title" className="mt-8 rounded-xl border border-line bg-field p-5 sm:p-6">
      <h2 id="search-title" className="text-2xl font-bold">Adicionar pessoas</h2>
      <p id="search-help" className="mt-3 leading-relaxed text-muted">Digite qualquer parte do nome, inclusive o nome do meio. Não precisa acertar os acentos. A pesquisa também sugere nomes com pequenos erros de digitação.</p>
      <p className="mt-2 text-base leading-relaxed text-muted">A pessoa precisa ter uma conta. Confira o nome encontrado e use “Adicionar”.</p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <label htmlFor="member-search" className="font-bold">Pesquisar pessoas pelo nome</label>
        <input ref={input} id="member-search" name="q" type="search" value={query} onChange={(event) => change(event.target.value)} maxLength={100}
          autoComplete="off" aria-describedby="search-help" aria-controls="member-search-results" placeholder="Nome, sobrenome ou uma parte" className="min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base" />
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={term.length < 2} className="min-h-12 rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 disabled:opacity-65">Pesquisar</button>
          {query && <button type="button" onClick={() => { change(""); input.current?.focus(); }} className="min-h-12 rounded-lg border border-ink px-4 py-3 text-base underline underline-offset-4">Limpar pesquisa</button>}
        </div>
      </form>
      <p role="status" aria-live="polite" className="mt-4 text-base leading-relaxed text-muted">{message}</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-error-bg p-3 text-base text-error">{error}</p>}
      <div id="member-search-results" aria-busy={pending}>
        {result.items.length > 0 && <ul aria-label="Resultados da pesquisa" className="mt-4 divide-y divide-line">
          {result.items.map((candidate) => <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="min-w-0 font-bold wrap-anywhere">{candidate.name}</p><GroupOperationButton operation="add" groupId={groupId} participantId={candidate.id} participantName={candidate.name} /></li>)}
        </ul>}
        {result.nextCursor && <button type="button" disabled={pending} onClick={() => { revision.current++; setCursor(result.nextCursor); setRetry((value) => value + 1); setError(""); setPending(true); }} className="mt-3 min-h-12 py-3 font-bold underline underline-offset-4 disabled:opacity-65">Ver mais resultados</button>}
      </div>
    </section>
  );
}
