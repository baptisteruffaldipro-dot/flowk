import { useParams, Navigate } from "react-router-dom";
import BrandStrategyView from "@/components/brand-strategy/BrandStrategyView";
import { brandStrategies } from "@/data/brand-strategies";

export default function BrandStrategy() {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug ?? "garden-tennis-royan";
  const strategy = brandStrategies[activeSlug];

  if (!strategy) {
    return <Navigate to="/strategie/garden-tennis-royan" replace />;
  }

  return <BrandStrategyView strategy={strategy} />;
}
