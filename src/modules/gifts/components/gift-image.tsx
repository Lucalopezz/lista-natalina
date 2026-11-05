"use client";

import { useState } from "react";

/* eslint-disable @next/next/no-img-element -- URLs arbitrárias são carregadas diretamente no navegador; não habilitar um proxy de imagens no servidor para elas. */
export function GiftImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  // O banco guarda string vazia quando não há imagem. O padrão é apresentação,
  // não um endereço de produção persistido que quebraria em outro domínio.
  const illustrative = !src || failed;
  return (
    <img
      src={illustrative ? "/images/gift-default.svg" : src}
      alt={illustrative ? `Imagem ilustrativa de ${name}` : name}
      width={640} height={480} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(true)} className="aspect-[4/3] w-full bg-soft object-contain"
    />
  );
}
