import { Brand } from "@/components/brand";
import Link from "next/link";

const features = [
  { number: "01", title: "Seus desejos, em um lugar", text: "Uma lista pessoal para reunir ideias de presentes e facilitar cada escolha." },
  { number: "02", title: "Presentes que aproximam", text: "Grupos para compartilhar desejos com a família, os amigos e quem faz parte da sua vida." },
  { number: "03", title: "Uma surpresa bem guardada", text: "Amigo secreto com resultados individuais e reservas discretas para manter o encanto." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-[1160px] px-6 pt-7 md:px-12 md:pt-10">
      <header><Brand /></header>
      <section className="max-w-[850px] pt-18 pb-14 md:pt-24 md:pb-18" aria-labelledby="hero-title">
        <p className="text-[11px] leading-[1.8] font-bold tracking-[2px] text-accent uppercase">Bons encontros começam com carinho</p>
        <h1 className="my-6 font-display text-[clamp(42px,7vw,86px)] leading-[1.08] font-normal tracking-[-2px]" id="hero-title">O melhor presente<br />é <em className="font-normal text-accent">celebrar juntos.</em></h1>
        <p className="max-w-[530px] text-[17px] leading-[1.8] text-muted">Menos dúvidas na hora de escolher. Mais significado na hora de presentear. Um espaço para seus desejos e suas pessoas favoritas.</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3"><Link className="inline-flex min-h-12 items-center justify-center rounded-lg border px-[22px] py-3 text-sm no-underline transition-colors disabled:cursor-wait disabled:opacity-65 border-accent bg-accent text-white hover:bg-[#8e182d]" href="/cadastro">Criar minha conta</Link><Link className="inline-block py-3 text-sm font-medium text-accent underline underline-offset-4" href="/entrar">Já tenho uma conta →</Link></div>
      </section>
      <section className="grid gap-7 border-t border-line pt-8 pb-12 md:grid-cols-3 md:gap-10 md:pt-10 md:pb-14" aria-label="O que estamos preparando">
        {features.map((feature) => <article key={feature.number} className="border-l-2 border-gold/40 pl-5"><span className="text-xs text-gold" aria-hidden="true">{feature.number}</span><h2 className="mt-4 mb-2.5 text-lg font-medium tracking-[-0.4px]">{feature.title}</h2><p className="m-0 max-w-[310px] text-sm leading-[1.8] text-muted">{feature.text}</p></article>)}
      </section>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-line py-6 text-[11px] leading-[1.8] text-muted">Feito para compartilhar bons momentos.<span>Lista Natalina</span></footer>
    </main>
  );
}
