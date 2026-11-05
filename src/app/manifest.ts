import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lista Natalina",
    short_name: "Lista Natalina",
    description: "Organize sua lista de presentes e seus grupos.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#fff9f0",
    theme_color: "#163f2d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
