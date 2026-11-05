import { requireCurrentUser } from "@/modules/auth/session";
export const metadata = { title: "Meu perfil | Lista Natalina" };
export default async function ProfilePage() {
  const user = await requireCurrentUser();
  return (
    <section className="max-w-2xl py-8">
      <h1 className="text-3xl font-bold">Meu perfil</h1>
      <p className="mt-3 text-muted">Estes são os dados da sua conta.</p>
      <dl className="mt-6 grid gap-6 rounded-xl border border-line bg-field p-6">
        <div><dt className="font-bold">Nome</dt><dd className="mt-2 wrap-anywhere">{user.name}</dd></div>
        <div><dt className="font-bold">Email</dt><dd className="mt-2 wrap-anywhere">{user.email}</dd></div>
      </dl>
      <p className="mt-5 leading-relaxed text-muted">Só você vê seu email. Outras pessoas veem apenas seu nome.</p>
    </section>
  );
}
