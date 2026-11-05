"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass = "min-h-12 w-full rounded-lg border border-[#8c998d] bg-field p-3 text-base text-ink";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <form className="mt-6 grid gap-5" onSubmit={submit} aria-busy={pending}>
      {signup && (
        <div className="grid gap-2.5">
          <label className="font-bold" htmlFor="name">Seu nome</label>
          <input className={inputClass} id="name" name="name" autoComplete="name" required maxLength={100} disabled={pending} />
        </div>
      )}
      <div className="grid gap-2.5">
        <label className="font-bold" htmlFor="email">Email</label>
        <input className={inputClass} id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} />
      </div>
      <div className="grid gap-2.5">
        <label className="font-bold" htmlFor="password">Senha</label>
        <input className={inputClass} id="password" name="password" type={showPassword ? "text" : "password"}
          autoComplete={signup ? "new-password" : "current-password"} required minLength={6} maxLength={128}
          aria-describedby="password-hint" disabled={pending} />
        {/* O botão só muda a apresentação local do campo. Não envia formulário,
            não altera a senha e não persiste credenciais no navegador. */}
        <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-controls="password" aria-pressed={showPassword}
          disabled={pending} className="min-h-12 justify-self-start rounded-lg border border-line px-4 py-3 text-base underline underline-offset-4">
          {showPassword ? "Ocultar senha" : "Mostrar senha"}
        </button>
        <p id="password-hint" className="text-base leading-relaxed text-muted">De 6 a 128 caracteres.</p>
      </div>
      {error && <p className="rounded-lg bg-error-bg p-4 text-base leading-relaxed text-error" role="alert">{error}</p>}
      <button className="min-h-12 rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90 disabled:cursor-wait disabled:opacity-65" type="submit" disabled={pending}>
        {pending ? "Aguarde…" : signup ? "Criar minha conta" : "Entrar"}
      </button>
      <p className="text-center text-base leading-relaxed">
        {signup ? "Já tem uma conta? " : "Ainda não tem conta? "}
        <Link className="inline-flex min-h-12 items-center py-3 font-bold underline underline-offset-4" href={signup ? "/entrar" : "/cadastro"}>
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </form>
  );
}
