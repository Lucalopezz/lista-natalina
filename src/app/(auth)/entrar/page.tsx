import { AuthForm } from "@/modules/auth/components/auth-form";
export const metadata = { title: "Entrar | Lista Natalina" };
export default function SignInPage() {
  return (
    <section className="mt-8 rounded-xl border border-line bg-field p-5 sm:p-7" aria-labelledby="signin-title">
      <h1 id="signin-title" className="text-3xl font-bold">Entrar na minha conta</h1>
      <p className="mt-3 leading-relaxed text-muted">Digite o email e a senha que você usou no cadastro.</p>
      <AuthForm mode="sign-in" />
    </section>
  );
}
