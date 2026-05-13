export interface LogoVariant {
  label: string;          // Logo principal / secondaire / submark
  description: string;
  usage: string;
  // Mises en situation : la même variante sur plusieurs fonds
  shots: { background: "light" | "dark" | "color"; bgColor?: string; imageUrl: string; caption?: string }[];
}

export interface LogoTrack {
  name: string;           // "Piste 1", "Piste 2", etc. (libre)
  intro: string;
  primary: LogoVariant;
  secondary: LogoVariant;
  submark: LogoVariant;
}

export interface MoodboardUniverse {
  name: string;           // "Univers 1", "Univers 2", etc. (libre)
  intro: string;
  keywords: string[];
  images: { url: string; caption?: string }[];
}

export interface LogoPresentation {
  slug: string;
  client: string;
  projectName: string;
  version: string;
  tagline: string;

  // 1 — Brief / intro
  brief: {
    intro: string;
    objectives: string[];
    deliverables: string[];
  };

  // 2 — Moodboard
  moodboard: {
    universes: MoodboardUniverse[];
  };

  // 3 — Logos (3 formes)
  logos: {
    tracks: LogoTrack[];
  };

  // 4 — Couleurs (multi-pistes)
  colors: {
    tracks: ColorsTrack[];
  };

  // 5 — Typographies (multi-pistes)
  typography: {
    tracks: TypographyTrack[];
  };

  // 6 — En action (multi-pistes)
  inSitu: {
    tracks: InSituTrack[];
  };
}

export interface ColorsTrack {
  name: string;
  intro: string;
  palette: { name: string; hex: string; usage: string }[];
}

export interface TypographyTrack {
  name: string;
  intro: string;
  fonts: {
    role: string;
    name: string;
    sample: string;
    usage: string;
    googleFontUrl?: string;
    fontFileUrl?: string;
    fontFileFormat?: string; // truetype, opentype, woff, woff2
  }[];
}

export interface InSituTrack {
  name: string;
  intro: string;
  items: { url: string; title?: string; caption?: string }[];
}