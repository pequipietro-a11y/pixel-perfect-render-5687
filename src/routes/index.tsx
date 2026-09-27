import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/components/motion/Editor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fluxo — Editor de Motion Design" },
      {
        name: "description",
        content:
          "Editor de motion design no navegador: camadas, linha do tempo, keyframes, curvas de suavização e efeitos em tempo real.",
      },
      { property: "og:title", content: "Fluxo — Editor de Motion Design" },
      {
        property: "og:description",
        content:
          "Anime formas, textos e imagens com keyframes e curvas de suavização direto no navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

