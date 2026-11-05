import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lista Natalina | Presentes e encontros",
  description: "Um lugar para organizar desejos, compartilhar presentes e celebrar juntos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
