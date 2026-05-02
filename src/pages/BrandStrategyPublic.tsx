import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BrandStrategyView from "@/components/brand-strategy/BrandStrategyView";
import type { BrandStrategy } from "@/data/brand-strategies/types";
import { emptyBrandStrategyContent } from "@/data/brand-strategies/empty";

export default function BrandStrategyPublic() {
  const { token } = useParams<{ token: string }>();
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    supabase.rpc("get_brand_strategy_by_token" as any, { _token: token }).then(({ data, error: err }) => {
      if (err || !data) { setError("Stratégie introuvable ou non publiée."); return; }
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) { setError("Stratégie introuvable ou non publiée."); return; }
      setStrategy({
        slug: row.id,
        client: row.client_name,
        projectName: row.project_name,
        version: row.version,
        tagline: row.tagline,
        ...emptyBrandStrategyContent,
        ...(row.content || {}),
      });
    });
  }, [token]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground p-8 text-center">{error}</div>;
  }
  if (!strategy) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  return <BrandStrategyView strategy={strategy} />;
}
