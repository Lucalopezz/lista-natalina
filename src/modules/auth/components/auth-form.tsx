"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const body = { email: fields.get("email"), password: fields.get("password"), ...(signup ? { name: fields.get("name") } : {}) };
    try {
      const response = await fetch(`/api/auth/${mode}/email`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "Não foi possível continuar. Tente novamente."); return; }
      // O cookie é HttpOnly e foi emitido pelo servidor. Nenhuma credencial vai
      // para localStorage; a página privada volta a validar a sessão no backend.
      router.replace("/dashboard");
      router.refresh();
    } catch { setError("Não foi possível conectar. Confira sua conexão e tente novamente."); }
    finally { setPending(false); }
  }

  return <form className="mt-8 grid gap-6" onSubmit={submit} aria-busy={pending}>
    {signup && <div className="grid gap-2.5"><label className="text-sm font-bold" htmlFor="name">Seu nome</label><input className="min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink" id="name" name="name" autoComplete="name" required maxLength={100} disabled={pending} /></div>}
    <div className="grid gap-2.5"><label className="text-sm font-bold" htmlFor="email">Email</label><input className="min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink" id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></div>
    <div className="grid gap-2.5"><label className="text-sm font-bold" htmlFor="password">Senha</label><input className="min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink" id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={6} maxLength={128} aria-describedby="password-hint" disabled={pending} /><p id="password-hint" className="m-0 text-[13px] leading-relaxed text-muted">De 6 a 128 caracteres.</p></div>
    {error && <p className="m-0 rounded-lg bg-error-bg p-3.5 text-sm leading-relaxed text-error" role="alert">{error}</p>}
    <button className="inline-flex min-h-12 items-center justify-center rounded-lg border px-[22px] py-3 text-sm no-underline transition-colors disabled:cursor-wait disabled:opacity-65 border-accent bg-accent text-white hover:bg-[#8e182d]" type="submit" disabled={pending}>{pending ? "Aguarde…" : signup ? "Criar minha conta" : "Entrar"}</button>
    <p className="m-0 text-center text-sm leading-[1.8] [&_a]:py-2 [&_a]:underline [&_a]:underline-offset-4">{signup ? "Já tem uma conta? " : "Ainda não tem conta? "}<Link href={signup ? "/entrar" : "/cadastro"}>{signup ? "Entrar" : "Criar conta"}</Link></p>
  </form>;
}
