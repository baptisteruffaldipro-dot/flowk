import type { LogoPresentation, LogoVariant, LogoTrack, MoodboardUniverse, ColorsTrack, TypographyTrack, InSituTrack } from "./types";

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

export const emptyColorsTrack = (name: string): ColorsTrack => ({
  name,
  intro: "",
  palette: [],
});

export const emptyTypographyTrack = (name: string): TypographyTrack => ({
  name,
  intro: "",
  fonts: [],
});

export const emptyInSituTrack = (name: string): InSituTrack => ({
  name,
  intro: "",
  items: [],
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
    tracks: [emptyColorsTrack("Piste 1")],
  },
  typography: {
    tracks: [emptyTypographyTrack("Piste 1")],
  },
  inSitu: {
    tracks: [emptyInSituTrack("Piste 1")],
  },
};