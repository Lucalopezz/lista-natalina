import Link from "next/link";
import { requireCurrentUser } from "@/modules/auth/session";

export default async function DashboardPage() {
  // Proteção na própria página: o layout facilita navegação, mas não substitui
  // a autorização do recurso que está sendo lido (nem das futuras operações).
  const user = await requireCurrentUser();
  return <section className="py-12"><p className="text-[11px] leading-[1.8] font-bold tracking-[2px] text-accent uppercase">Sua conta está pronta</p><h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-[1.15] font-normal tracking-[-1px] wrap-anywhere">Olá, {user.name}.</h1><p className="max-w-[640px] leading-[1.8] text-muted">Que bom ter você por aqui. Este será o seu espaço para organizar presentes e encontros.</p><div className="mt-8 rounded-xl border border-line bg-soft/60 p-6"><h2 className="mt-4 mb-2.5 text-lg font-medium tracking-[-0.4px]">Estamos preparando os próximos encontros</h2><p>As listas de presentes, os grupos e os sorteios chegam nas próximas etapas.</p><Link className="inline-block py-3 text-sm font-medium text-accent underline underline-offset-4" href="/perfil">Ver meu perfil →</Link></div></section>;
}
