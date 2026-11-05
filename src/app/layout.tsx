import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lista Natalina | Presentes e encontros",
  description: "Um lugar para organizar desejos, compartilhar presentes e celebrar juntos.",
};

export const viewport: Viewport = { themeColor: "#163f2d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
