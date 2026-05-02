import type { BrandStrategy } from "./types";
import { gardenTennisStrategy } from "./garden-tennis";

export const brandStrategies: Record<string, BrandStrategy> = {
  [gardenTennisStrategy.slug]: gardenTennisStrategy,
};

export type { BrandStrategy };
