import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";

type Mode = "pct" | "amount";

export type SplitDraft = { business_unit_id: string; share_pct: number };

/**
 * Ventilation manuelle d'une ligne entre plusieurs pôles.
 * Quand elle est active, elle prime sur le pôle unique et sur la règle
 * globale de charges communes.
 */
export default function TxSplitEditor({
  transactionId,
  amountHt,
  value,
  onChange,
}: {
  transactionId?: string | null;
  amountHt: number;
  value: SplitDraft[];
  onChange: (rows: SplitDraft[]) => void;
}) {
  const { activeUnits } = useBusinessUnits();
  const [enabled, setEnabled] = useState(value.length > 0);
  const [mode, setMode] = useState<Mode>("pct");
  const total = Math.abs(Number(amountHt) || 0);

  useEffect(() => {
    if (!transactionId) return;
    (async () => {
      const { data } = await supabase
        .from("finance_tx_splits")
        .select("business_unit_id, share_pct")
        .eq("transaction_id", transactionId);
      const rows = ((data as any[]) ?? []).map((r) => ({
        business_unit_id: r.business_unit_id,
        share_pct: Number(r.share_pct) || 0,
      }));
      if (rows.length) {
        setEnabled(true);
        onChange(rows);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const sumPct = useMemo(() => value.reduce((a, r) => a + (Number(r.share_pct) || 0), 0), [value]);

  const setPct = (buId: string, pct: number) => {
    const next = value.filter((r) => r.business_unit_id !== buId);
    if (pct > 0) next.push({ business_unit_id: buId, share_pct: pct });
    onChange(next);
  };

  const toggle = (on: boolean) => {
    setEnabled(on);
    if (!on) onChange([]);
  };

  const equalize = () => {
    const ids = value.length ? value.map((r) => r.business_unit_id) : activeUnits.map((u) => u.id);
    const pct = Number((100 / ids.length).toFixed(2));
    onChange(ids.map((id) => ({ business_unit_id: id, share_pct: pct })));
  };

  return (
    <div className="sm:col-span-2 rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">Ventilation entre plusieurs pôles</Label>
          <p className="text-[11px] text-muted-foreground">
            Prioritaire sur le pôle unique et sur la règle de charges communes.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-2 text-xs">
            <Button type="button" size="sm" variant={mode === "pct" ? "default" : "outline"} onClick={() => setMode("pct")}>%</Button>
            <Button type="button" size="sm" variant={mode === "amount" ? "default" : "outline"} onClick={() => setMode("amount")}>€ HT</Button>
            <Button type="button" size="sm" variant="ghost" onClick={equalize}>Répartir également</Button>
          </div>

          <div className="space-y-2">
            {activeUnits.map((u) => {
              const pct = value.find((r) => r.business_unit_id === u.id)?.share_pct ?? 0;
              const amt = (total * pct) / 100;
              return (
                <div key={u.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: u.color }} />
                  <span className="text-sm flex-1 truncate">{u.name}</span>
                  {mode === "pct" ? (
                    <>
                      <Input
                        type="number" step="0.01" min="0" className="w-24 h-8"
                        value={pct === 0 ? "" : pct}
                        onChange={(e) => setPct(u.id, Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right tabular-nums">{fmtMoney(amt)}</span>
                    </>
                  ) : (
                    <>
                      <Input
                        type="number" step="0.01" min="0" className="w-28 h-8"
                        value={amt === 0 ? "" : Number(amt.toFixed(2))}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setPct(u.id, total > 0 ? Number(((v / total) * 100).toFixed(4)) : 0);
                        }}
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">{pct.toFixed(1)}%</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`text-xs ${Math.abs(sumPct - 100) < 0.5 ? "text-muted-foreground" : "text-amber-600"}`}>
            Total réparti : {sumPct.toFixed(1)}% ({fmtMoney((total * sumPct) / 100)} sur {fmtMoney(total)})
            {Math.abs(sumPct - 100) >= 0.5 && " — la répartition sera ramenée au prorata."}
          </div>
        </>
      )}
    </div>
  );
}

/** Enregistre la ventilation d'une transaction (remplace l'existante). */
export async function saveTxSplits(transactionId: string, rows: SplitDraft[]) {
  await supabase.from("finance_tx_splits").delete().eq("transaction_id", transactionId);
  const clean = rows.filter((r) => (Number(r.share_pct) || 0) > 0);
  if (!clean.length) return;
  const { error } = await supabase
    .from("finance_tx_splits")
    .insert(clean.map((r) => ({ transaction_id: transactionId, business_unit_id: r.business_unit_id, share_pct: r.share_pct })));
  if (error) toast.error(error.message);
}
