import { AuthForm } from "@/modules/auth/components/auth-form";
export const metadata = { title: "Criar conta | Lista Natalina" };
export default function SignUpPage() {
  return (
    <section className="mt-8 rounded-xl border border-line bg-field p-5 sm:p-7" aria-labelledby="signup-title">
      <h1 id="signup-title" className="text-3xl font-bold">Criar minha conta</h1>
      <p className="mt-3 leading-relaxed text-muted">Preencha os três campos abaixo. Depois, você já pode fazer sua lista.</p>
      <AuthForm mode="sign-up" />
    </section>
  );
}
