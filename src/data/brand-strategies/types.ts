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
}
