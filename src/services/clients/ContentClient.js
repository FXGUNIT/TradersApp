import { SCREEN_IDS } from "../../features/shell/screenIds.js";

const HUB_CONTENT = Object.freeze({
  eyebrow: "TRADERS REGIMENT",
  title: "Command Centre",
  description: "Select your operational wing to proceed.",
  cards: [
    {
      id: "artillery",
      title: "TRADERS REGIMENT ARTILLERY CENTRE",
      description:
        "Live MNQ/MES execution, order flow analysis, and capital deployment.",
      action: SCREEN_IDS.APP,
      accentToken: "var(--accent-primary, #2563eb)",
      glowToken: "var(--accent-glow, rgba(37,99,235,0.3))",
    },
    {
      id: "consciousness",
      title: "TR'S COLLECTIVE CONSCIOUSNESS",
      description:
        "Engage the intelligence grid for recursive market strategy and risk analysis.",
      action: SCREEN_IDS.CONSCIOUSNESS,
      accentToken: "var(--amd-manipulation, #BF5AF2)",
      glowToken: "rgba(191,90,242,0.3)",
    },
  ],
});

const DOCUMENT_META = Object.freeze({
  tos: { slug: "tos", title: "Terms of Service", surface: "legal" },
  privacy: { slug: "privacy", title: "Privacy Policy", surface: "legal" },
  eula: { slug: "eula", title: "Regiment Master EULA", surface: "legal" },
});

export async function getHubContent() {
  return HUB_CONTENT;
}

export function getDocumentMeta(slug) {
  return DOCUMENT_META[slug] || null;
}

export default {
  getHubContent,
  getDocumentMeta,
};
