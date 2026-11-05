const features = [
  { number: "01", title: "Seus desejos, em um lugar", text: "Uma lista pessoal para reunir ideias de presentes e facilitar cada escolha." },
  { number: "02", title: "Presentes que aproximam", text: "Grupos para compartilhar desejos com a família, os amigos e quem faz parte da sua vida." },
  { number: "03", title: "Uma surpresa bem guardada", text: "Amigo secreto com resultados individuais e reservas discretas para manter o encanto." },
];

export default function Home() {
  return (
    <main>
      <header className="brand"><span className="brand-mark" aria-hidden="true">✳</span> Lista Natalina</header>
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Bons encontros começam com carinho</p>
        <h1 id="hero-title">O melhor presente<br />é <em>celebrar juntos.</em></h1>
        <p className="intro">Menos dúvidas na hora de escolher. Mais significado na hora de presentear. Um espaço para seus desejos e suas pessoas favoritas.</p>
        <p className="status"><span aria-hidden="true" /> Em preparação · Em breve por aqui</p>
      </section>
      <section className="features" aria-label="O que estamos preparando">
        {features.map((feature) => <article key={feature.number}><span className="number" aria-hidden="true">{feature.number}</span><h2>{feature.title}</h2><p>{feature.text}</p></article>)}
      </section>
      <footer>Feito para compartilhar bons momentos.<span>Lista Natalina</span></footer>
    </main>
  );
}
