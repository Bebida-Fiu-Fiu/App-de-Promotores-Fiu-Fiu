import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App de Promotores Fiu Fiu",
    short_name: "Fiu Fiu",
    description: "Aplicativo de apoio para cadastro e acompanhamento de visitas de promotores.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c2432",
    theme_color: "#0c2432",
    orientation: "portrait",
    lang: "pt-BR",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
