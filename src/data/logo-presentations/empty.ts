import type { LogoPresentation, LogoVariant, LogoTrack, MoodboardUniverse } from "./types";

const emptyVariant = (label: string, usage: string): LogoVariant => ({
  label,
  description: "",
  usage,
  shots: [],
});

export const emptyTrack = (name: string): LogoTrack => ({
  name,
  intro: "",
  primary: emptyVariant("Logo principal", "Version complète, à privilégier sur tous les supports majeurs."),
  secondary: emptyVariant("Logo secondaire", "Composition alternative pour les formats restreints."),
  submark: emptyVariant("Submark", "Version simplifiée pour les très petits formats (avatar, favicon, badge)."),
});

export const emptyUniverse = (name: string): MoodboardUniverse => ({
  name,
  intro: "",
  keywords: [],
  images: [],
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
    universes: [emptyUniverse("Univers 1")],
  },
  logos: {
    tracks: [emptyTrack("Piste 1")],
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