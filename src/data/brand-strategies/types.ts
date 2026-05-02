export interface BrandStrategy {
  slug: string;
  client: string;
  projectName: string;
  version: string;
  tagline: string;

  positioning: string;

  promise: {
    headline: string;
    before: string;
    after: string;
  };

  signature: {
    signature: string;
    thread: string;
  };

  storytelling: {
    title: string;
    paragraphs: string[];
    pullQuote: string;
    proof: { tells: string; proves: string; useFor: string };
  };

  pillars: { name: string; description: string }[];

  signatureMoments: {
    index: string;
    title: string;
    when: string;
    intro: string;
    lives: string;
    tells: string;
    role: string;
    quote: string;
  }[];

  voice: {
    is: string[];
    isNot: string[];
  };

  swot: {
    strengths: { title: string; detail: string }[];
    weaknesses: { title: string; detail: string }[];
    opportunities: { title: string; detail: string }[];
    threats: { title: string; detail: string }[];
  };

  naming: {
    intro: string;
    strategies: {
      code: string;
      title: string;
      description: string;
      directions: { name: string; signatures: string[] }[];
      explorations: string[];
    }[];
  };

  todo: string[];

  // Sections « next steps » — toutes optionnelles pour rester compatibles
  visualTerritory?: {
    intro: string;
    keywords: string[];
    references: string[];
    notes: string;
  };

  persona?: {
    intro: string;
    profiles: {
      firstName: string;
      age: string;
      role: string;
      bio: string;
      lifestyle: string;
      needs: string;
      quote: string;
    }[];
  };

  launchPlan?: {
    intro: string;
    phases: {
      title: string;
      timing: string;
      objective: string;
      actions: string[];
      channels: string[];
    }[];
  };

  moodboard?: {
    intro: string;
    universes: {
      name: string;
      description: string;
      keywords: string[];
      references: string[];
    }[];
  };

  logoSystem?: {
    intro: string;
    items: {
      type: string;        // Logo principal / secondaire / submark
      name: string;
      usage: string;
      description: string;
    }[];
  };

  typography?: {
    intro: string;
    fonts: {
      role: string;        // Primaire / Secondaire / Soutien
      name: string;
      usage: string;
      sample: string;
    }[];
  };

  colorPalette?: {
    intro: string;
    primary: { name: string; hex: string; usage: string }[];
    neutrals: { name: string; hex: string; usage: string }[];
  };

  inSitu?: {
    intro: string;
    items: {
      title: string;
      context: string;
      description: string;
    }[];
  };
}
