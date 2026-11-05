"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="py-12"><h1 className="my-6 font-display text-[clamp(32px,5vw,48px)] leading-[1.15] font-normal tracking-[-1px] wrap-anywhere">Não foi possível carregar sua conta.</h1><p>Tente novamente em instantes.</p><button className="inline-flex min-h-12 items-center justify-center rounded-lg border px-[22px] py-3 text-sm no-underline transition-colors disabled:cursor-wait disabled:opacity-65 border-accent bg-accent text-white hover:bg-[#8e182d]" onClick={reset}>Tentar novamente</button></section>;
}
