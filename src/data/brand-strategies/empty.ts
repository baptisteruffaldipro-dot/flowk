import type { BrandStrategy } from "./types";

export const emptyBrandStrategyContent: Omit<BrandStrategy, "slug" | "client" | "projectName" | "version" | "tagline"> = {
  positioning: "",
  promise: { headline: "", before: "", after: "" },
  signature: { signature: "", thread: "" },
  storytelling: {
    title: "",
    paragraphs: [""],
    pullQuote: "",
    proof: { tells: "", proves: "", useFor: "" },
  },
  pillars: [{ name: "", description: "" }],
  signatureMoments: [
    { index: "01", title: "", when: "", intro: "", lives: "", tells: "", role: "", quote: "" },
  ],
  voice: { is: [], isNot: [] },
  swot: {
    strengths: [{ title: "", detail: "" }],
    weaknesses: [{ title: "", detail: "" }],
    opportunities: [{ title: "", detail: "" }],
    threats: [{ title: "", detail: "" }],
  },
  naming: {
    intro: "",
    strategies: [
      {
        code: "A",
        title: "",
        description: "",
        directions: [{ name: "", signatures: [""] }],
        explorations: [],
      },
    ],
  },
  todo: [],

  visualTerritory: { intro: "", keywords: [], references: [], notes: "" },
  persona: { intro: "", profiles: [] },
  launchPlan: { intro: "", phases: [] },
  moodboard: { intro: "", universes: [] },
  logoSystem: { intro: "", items: [] },
  typography: { intro: "", fonts: [] },
  colorPalette: { intro: "", primary: [], neutrals: [] },
  inSitu: { intro: "", items: [] },
};
