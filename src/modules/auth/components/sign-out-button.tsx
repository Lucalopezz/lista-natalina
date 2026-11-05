"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) { setError("Não foi possível sair. Tente novamente."); return; }
      router.replace("/entrar");
      router.refresh();
    } catch { setError("Confira sua conexão e tente novamente."); }
    finally { setPending(false); }
  }
  return <div><button className="inline-flex min-h-12 items-center justify-center rounded-lg border px-[22px] py-3 text-base no-underline transition-colors disabled:cursor-wait disabled:opacity-65 border-ink bg-transparent text-ink hover:bg-soft" onClick={signOut} disabled={pending}>{pending ? "Saindo…" : "Sair da conta"}</button>{error && <p role="alert" className="m-0 rounded-lg bg-error-bg p-3.5 text-base leading-relaxed text-error">{error}</p>}</div>;
}
