import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lista Natalina | Listas de presentes",
  description: "Organize sua lista de presentes e reúna família e amigos em grupos.",
};

export const viewport: Viewport = { themeColor: "#163f2d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
