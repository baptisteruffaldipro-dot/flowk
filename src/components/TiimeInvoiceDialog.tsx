import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { getFunctionErrorMessage } from "@/lib/function-errors";
import { InvoiceLine, prestationLine, printLine, invoiceTotals, sendableLines } from "@/lib/tiimeInvoice";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  title?: string;
  /** Tâche à facturer (prestation) + ses impressions liées */
  task?: { id: string; title?: string | null; tiime_invoice_id?: string | null } | null;
  prestationHT?: number;
  /** Commandes d'impression à proposer (si pas de tâche) */
  printOrderIds?: string[];
  onDone?: () => void;
};

export default function TiimeInvoiceDialog({ open, onOpenChange, clientId, title, task, prestationHT = 0, printOrderIds, onDone }: Props) {
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      let ids = printOrderIds ?? [];
      if (task) {
        const { data: portals } = await supabase
          .from("client_portals")
          .select("print_order_id, print_order_ids")
          .eq("entity_type", "task")
          .eq("entity_id", task.id);
        const set = new Set<string>(ids);
        (portals ?? []).forEach((p: any) => {
          (p.print_order_ids ?? []).forEach((x: string) => set.add(x));
          if (p.print_order_id) set.add(p.print_order_id);
        });
        ids = [...set];
      }
      const { data: pos } = ids.length
        ? await supabase.from("print_orders").select("id,description,reference,quantity,amount,format,support,grammage,colors,finitions,tiime_invoice_id").in("id", ids)
        : { data: [] as any[] };
      const next: InvoiceLine[] = [];
      if (task) next.push(prestationLine(task, prestationHT));
      (pos ?? []).forEach((po: any) => next.push(printLine(po)));
      setLines(next);
      setSelected(new Set(next.filter((l) => !l.already_invoiced && l.line_amount_ht > 0).map((l) => l.key)));
    })();
  }, [open, task?.id, prestationHT, (printOrderIds ?? []).join(",")]);

  const toSend = useMemo(() => sendableLines(lines, selected), [lines, selected]);
  const totals = invoiceTotals(toSend);

  const toggle = (k: string, v: boolean) =>
    setSelected((s) => { const n = new Set(s); v ? n.add(k) : n.delete(k); return n; });
  const setAmount = (k: string, v: string) =>
    setLines((ls) => ls.map((l) => {
      if (l.key !== k) return l;
      const amt = Math.max(0, Number(v) || 0);
      return { ...l, line_amount_ht: amt, unit_amount_ht: Math.round((amt / l.quantity) * 10000) / 10000 };
    }));

  const send = async () => {
    if (!clientId) return toast.error("Aucun client sur cette tâche");
    if (toSend.length === 0) return toast.error("Aucune ligne à facturer");
    setSending(true);
    const { data, error } = await supabase.functions.invoke("make-tiime-invoice", {
      body: { client_id: clientId, title, lines: toSend },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast.error(await getFunctionErrorMessage(error, data, "La facture n'a pas pu être créée"));
      return;
    }
    const num = (data as any)?.number;
    toast.success(num ? `Facture Tiime n° ${num} créée (brouillon)` : "Facture envoyée à Tiime (brouillon)");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer la facture Tiime</DialogTitle>
          <DialogDescription>Une seule facture, créée en brouillon dans Tiime. Tu la relis et l'envoies depuis Tiime.</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-2">
          {lines.length === 0 && <p className="text-sm text-muted-foreground">Rien à facturer.</p>}
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                checked={selected.has(l.key) && !l.already_invoiced}
                disabled={l.already_invoiced}
                onCheckedChange={(v) => toggle(l.key, !!v)}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium whitespace-pre-line break-words">{l.description}</div>
                <div className="text-xs text-muted-foreground">
                  {l.source === "task" ? "Prestation" : `Impression · ${l.quantity} ex.`}
                  {l.already_invoiced && " · déjà facturée"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Input
                  type="number" step="0.01" className="h-8 w-28 text-right"
                  value={l.line_amount_ht} disabled={l.already_invoiced}
                  onChange={(e) => setAmount(l.key, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">HT</span>
              </div>
            </div>
          ))}
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground"><span>Total HT</span><span>{fmtMoney(totals.ht)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>TVA 20 %</span><span>{fmtMoney(totals.vat)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total TTC</span><span>{fmtMoney(totals.ttc)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Annuler</Button>
          <Button onClick={send} disabled={sending || toSend.length === 0}>
            {sending ? "Envoi…" : "Créer la facture Tiime"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
