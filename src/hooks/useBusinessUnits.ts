import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BusinessUnit = {
  id: string;
  code: string;
  name: string;
  color: string;
  position: number;
  active: boolean;
  note: string | null;
};

let cache: BusinessUnit[] | null = null;
const listeners = new Set<(u: BusinessUnit[]) => void>();

export async function reloadBusinessUnits() {
  const { data } = await supabase
    .from("business_units")
    .select("id, code, name, color, position, active, note")
    .order("position");
  cache = (data as BusinessUnit[]) ?? [];
  listeners.forEach((l) => l(cache!));
  return cache;
}

export function useBusinessUnits() {
  const [units, setUnits] = useState<BusinessUnit[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    listeners.add(setUnits);
    if (cache === null) {
      reloadBusinessUnits().then(() => setLoading(false));
    } else {
      setUnits(cache);
    }
    return () => {
      listeners.delete(setUnits);
    };
  }, []);

  const byId = new Map(units.map((u) => [u.id, u]));
  return { units, activeUnits: units.filter((u) => u.active), byId, loading };
}
