import { AuthForm } from "@/modules/auth/components/auth-form";
export const metadata = { title: "Entrar | Lista Natalina" };
export default function SignInPage() {
  return <section className="mt-14" aria-labelledby="signin-title"><p className="text-[11px] leading-[1.8] font-bold tracking-[2px] text-accent uppercase">Bom ter você por aqui</p><h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-[1.15] font-normal tracking-[-1px] wrap-anywhere" id="signin-title">Entre na sua conta.</h1><p className="max-w-[640px] leading-[1.8] text-muted">Seu próximo bom encontro começa aqui.</p><AuthForm mode="sign-in" /></section>;
}
