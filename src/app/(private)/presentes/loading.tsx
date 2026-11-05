export default function LoadingGifts() {
  return <div className="py-12"><p role="status" className="text-base text-muted">Carregando seus presentes…</p><div aria-hidden="true" className="mt-6 grid gap-6 md:grid-cols-2">{[0, 1, 2].map((key) => <div key={key} className="h-80 rounded-2xl bg-soft motion-safe:animate-pulse" />)}</div></div>;
}
