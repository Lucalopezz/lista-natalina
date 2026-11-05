import { Brand } from "@/components/brand";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:py-10">
      <Brand />
      <section className="py-10 sm:py-14" aria-labelledby="hero-title">
        <h1 id="hero-title" className="max-w-xl text-3xl leading-tight font-bold sm:text-4xl">Organize sua lista de presentes de Natal</h1>
        <p className="mt-5 max-w-xl leading-relaxed text-muted">Anote o que você gostaria de ganhar e reúna sua família e seus amigos em grupos.</p>
        <div className="mt-7 grid max-w-md gap-4">
          <Link href="/entrar" className="flex min-h-14 items-center justify-center rounded-lg bg-ink px-5 py-3 text-base font-bold text-white hover:bg-ink/90">Entrar na minha conta</Link>
          <Link href="/cadastro" className="flex min-h-14 items-center justify-center rounded-lg border-2 border-ink bg-field px-5 py-3 text-base font-bold hover:bg-soft">Criar minha conta</Link>
        </div>
      </section>
      <section className="rounded-xl border border-line bg-field p-6" aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold">Como começar</h2>
        <ol className="mt-4 list-decimal space-y-4 pl-6 leading-relaxed">
          <li>Crie sua conta com nome, email e senha.</li>
          <li>Adicione os presentes que você gostaria de ganhar.</li>
          <li>Crie um grupo ou peça para alguém adicionar você a um grupo.</li>
        </ol>
      </section>
      <footer className="mt-8 border-t border-line py-5 text-base text-muted">Lista Natalina · Feito para a família toda.</footer>
    </main>
  );
}
