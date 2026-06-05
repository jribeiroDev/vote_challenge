import type { VoteItem } from "../types";

const imageSeeds = [
  "aurora",
  "orchid",
  "solstice",
  "atlas",
  "harbor",
  "pulse",
  "ripple",
  "signal",
  "canvas",
  "ember",
  "lumen",
  "horizon",
];

function makeImageUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}/800/600`;
}

function makeVideoUrl() {
  return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
}

function buildItem(index: number): VoteItem {
  const title = `Item ${index + 1}`;
  const isVideo = index % 6 === 2;
  const seed = imageSeeds[index % imageSeeds.length];

  return {
    id: `item-${index + 1}`,
    title,
    description: isVideo
      ? "Pré-visualização em vídeo para testar o fluxo de voto."
      : "Imagem de exemplo para o card do concurso.",
    mediaType: isVideo ? "video" : "image",
    mediaUrl: isVideo ? makeVideoUrl() : makeImageUrl(seed),
    posterUrl: isVideo ? makeImageUrl(`${seed}-poster`) : undefined,
    voteCount: 0,
    createdAt: new Date("2026-06-05T00:00:00.000Z").toISOString(),
  };
}

export const items = Array.from({ length: 28 }, (_, index) => buildItem(index));
