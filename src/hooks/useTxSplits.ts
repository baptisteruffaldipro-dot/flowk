import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TxSplit } from "@/lib/finance/units";

/**
 * Charge toutes les ventilations manuelles (transaction -> pôles).
 * La table reste petite : seules les lignes réellement partagées y figurent.
 */
export function useTxSplits(refreshKey?: unknown) {
  const [splits, setSplits] = useState<Map<string, TxSplit[]>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finance_tx_splits")
        .select("transaction_id, business_unit_id, share_pct");
      const map = new Map<string, TxSplit[]>();
      for (const r of (data as any[]) ?? []) {
        const list = map.get(r.transaction_id) ?? [];
        list.push({ business_unit_id: r.business_unit_id, share_pct: Number(r.share_pct) || 0 });
        map.set(r.transaction_id, list);
      }
      setSplits(map);
    })();
  }, [refreshKey]);

  return splits;
}
