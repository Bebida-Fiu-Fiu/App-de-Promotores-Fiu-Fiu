import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App de Promotores Fiu Fiu",
    short_name: "Fiu Fiu",
    description: "Aplicativo de apoio para cadastro e acompanhamento de visitas de promotores.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c2432",
    theme_color: "#0c2432",
    orientation: "portrait",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
