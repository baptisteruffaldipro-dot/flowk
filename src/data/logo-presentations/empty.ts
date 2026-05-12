import type { LogoPresentation, LogoVariant } from "./types";

const emptyVariant = (label: string, usage: string): LogoVariant => ({
  label,
  description: "",
  usage,
  shots: [],
});

export const emptyLogoPresentationContent: Omit<
  LogoPresentation,
  "slug" | "client" | "projectName" | "version" | "tagline"
> = {
  brief: {
    intro: "",
    objectives: [],
    deliverables: [],
  },
  moodboard: {
    intro: "",
    keywords: [],
    images: [],
  },
  logos: {
    intro: "",
    primary: emptyVariant("Logo principal", "Version complète, à privilégier sur tous les supports majeurs."),
    secondary: emptyVariant("Logo secondaire", "Composition alternative pour les formats restreints."),
    submark: emptyVariant("Submark", "Version simplifiée pour les très petits formats (avatar, favicon, badge)."),
  },
  colors: {
    intro: "",
    palette: [],
  },
  typography: {
    intro: "",
    fonts: [],
  },
  inSitu: {
    intro: "",
    items: [],
  },
};