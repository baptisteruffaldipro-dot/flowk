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
};
