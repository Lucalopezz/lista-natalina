import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  return (
    <section className="py-12">
      <p className="text-[11px] font-bold tracking-[2px] text-accent uppercase">Um lugar para suas pessoas e seus desejos</p>
      <h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-tight tracking-tight wrap-anywhere">Olá, {user.name}.</h1>
      <p className="max-w-xl leading-relaxed text-muted">Que bom ter você por aqui. Comece reunindo ideias para os próximos bons encontros.</p>
      <div className="mt-8 max-w-xl rounded-2xl border border-line bg-soft/60 p-6">
        <p aria-hidden="true" className="text-3xl">🎁</p>
        <h2 className="mt-4 font-display text-2xl">Minha lista de presentes</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">Livros, pequenos detalhes ou aquele desejo especial. Deixe as pistas de quem você é.</p>
        <Link className="mt-4 inline-block py-3 text-sm font-bold text-accent underline underline-offset-4" href="/presentes">Ver minha lista →</Link>
      </div>
    </section>
  );
}
