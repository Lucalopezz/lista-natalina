import { AuthForm } from "@/modules/auth/components/auth-form";
export const metadata = { title: "Criar conta | Lista Natalina" };
export default function SignUpPage() {
  return <section className="mt-14" aria-labelledby="signup-title"><p className="text-[11px] leading-[1.8] font-bold tracking-[2px] text-accent uppercase">Um espaço para suas pessoas</p><h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-[1.15] font-normal tracking-[-1px] wrap-anywhere" id="signup-title">Vamos celebrar juntos?</h1><p className="max-w-[640px] leading-[1.8] text-muted">Crie sua conta para começar.</p><AuthForm mode="sign-up" /></section>;
}
