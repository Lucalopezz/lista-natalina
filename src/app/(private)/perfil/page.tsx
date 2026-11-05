import { requireCurrentUser } from "@/modules/auth/session";
export const metadata = { title: "Meu perfil | Lista Natalina" };
export default async function ProfilePage() {
  const user = await requireCurrentUser();
  return <section className="py-12"><p className="text-[11px] leading-[1.8] font-bold tracking-[2px] text-accent uppercase">Seu espaço</p><h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-[1.15] font-normal tracking-[-1px] wrap-anywhere">Meu perfil.</h1><dl className="mt-8 mb-4 grid max-w-[600px] gap-6 rounded-xl border border-line bg-soft p-6"><div><dt className="mb-2 text-xs font-bold text-muted">Nome</dt><dd className="m-0 wrap-anywhere">{user.name}</dd></div><div><dt className="mb-2 text-xs font-bold text-muted">Email</dt><dd className="m-0 wrap-anywhere">{user.email}</dd></div></dl><p className="m-0 text-[13px] leading-relaxed text-muted">Seu email é privado e aparece apenas no seu próprio perfil.</p></section>;
}
