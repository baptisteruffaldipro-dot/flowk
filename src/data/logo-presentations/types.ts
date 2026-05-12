export interface LogoVariant {
  label: string;          // Logo principal / secondaire / submark
  description: string;
  usage: string;
  // Mises en situation : la même variante sur plusieurs fonds
  shots: { background: "light" | "dark" | "color"; bgColor?: string; imageUrl: string; caption?: string }[];
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
    intro: string;
    keywords: string[];
    images: { url: string; caption?: string }[];
  };

  // 3 — Logos (3 formes)
  logos: {
    intro: string;
    primary: LogoVariant;
    secondary: LogoVariant;
    submark: LogoVariant;
  };

  // 4 — Couleurs
  colors: {
    intro: string;
    palette: { name: string; hex: string; usage: string }[];
  };

  // 5 — Typographies
  typography: {
    intro: string;
    fonts: {
      role: string;       // Principale / Secondaire / Soutien
      name: string;
      sample: string;
      usage: string;
    }[];
  };

  // 6 — En action
  inSitu: {
    intro: string;
    items: { url: string; title?: string; caption?: string }[];
  };
}