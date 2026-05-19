import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, ExternalLink, Plus, Trash2, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { computeTaskBilling } from "@/lib/billing";

type Task = {
  id: string;
  title?: string | null;
  client_id?: string | null;
  billing_type?: string | null;
  flat_amount?: number | null;
  hourly_rate?: number | null;
  total_minutes?: number | null;
  hours?: number | null;
};

type Line = {
  category: "Presta" | "Bien";
  designation: string;
  quantity: string;
  unit: string;
  unit_price: string;
  vat: string;
};

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (invoiceId: string) => void;
  /** Optionnel : pré-remplissage depuis une facture existante (mode lecture, ne crée rien) */
  prefillInvoice?: { id: string; label: string; amount: number } | null;
};

const todayFR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copié`);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={copy}
      disabled={!value}
      title={`Copier ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function NewTiimeInvoiceDialog({ task, open, onOpenChange, onCreated, prefillInvoice }: Props) {
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState<string>("");

  const suggestedAmount = useMemo(() => {
    if (prefillInvoice) return prefillInvoice.amount;
    if (!task) return 0;
    if (task.billing_type === "forfait") return Number(task.flat_amount ?? 0);
    return computeTaskBilling(task as any).total ?? 0;
  }, [task, prefillInvoice]);

  const [label, setLabel] = useState("");
  const [issueDate, setIssueDate] = useState(todayFR());
  const [payment, setPayment] = useState("à réception");
  const [lines, setLines] = useState<Line[]>([
    { category: "Presta", designation: "", quantity: "1", unit: "", unit_price: "0", vat: "20" },
  ]);

  useEffect(() => {
    if (!open) return;
    const initLabel = prefillInvoice?.label ?? task?.title ?? "";
    setLabel(initLabel);
    setIssueDate(todayFR());
    setPayment("à réception");
    setLines([
      {
        category: "Presta",
        designation: initLabel,
        quantity: "1",
        unit: "",
        unit_price: String(suggestedAmount || 0),
        vat: "20",
      },
    ]);
    // Charger nom du client pour info
    const clientId = task?.client_id;
    if (clientId) {
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle().then(({ data }) => {
        setClientName((data as any)?.name ?? "");
      });
    } else {
      setClientName("");
    }
  }, [open, task?.id, prefillInvoice?.id]);

  const totalHT = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );
  const totalTVA = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + ((Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * (Number(l.vat) || 0)) / 100,
        0,
      ),
    [lines],
  );
  const totalTTC = totalHT + totalTVA;

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { category: "Presta", designation: "", quantity: "1", unit: "", unit_price: "0", vat: "20" },
    ]);

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const copyAll = async () => {
    const header = [
      `Intitulé : ${label}`,
      clientName ? `Client : ${clientName}` : null,
      `Date : ${issueDate}`,
      `Règlement : ${payment}`,
      "",
      "Désignation\tCatégorie\tQté\tUnité\tPU HT\tTVA\tMontant HT",
    ]
      .filter(Boolean)
      .join("\n");
    const rows = lines
      .map((l) => {
        const ht = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
        return `${l.designation}\t${l.category}\t${l.quantity}\t${l.unit}\t${l.unit_price}\t${l.vat}%\t${ht.toFixed(2)}`;
      })
      .join("\n");
    const totals = `\n\nTotal HT : ${totalHT.toFixed(2)} €\nTVA : ${totalTVA.toFixed(2)} €\nTotal TTC : ${totalTTC.toFixed(2)} €`;
    await navigator.clipboard.writeText(`${header}\n${rows}${totals}`);
    toast.success("Tout copié dans le presse-papier");
  };

  const saveInvoice = async () => {
    if (!task) return;
    if (!task.client_id) return toast.error("Cette tâche n'a pas de client");
    if (!label.trim()) return toast.error("Intitulé requis");
    if (totalHT <= 0) return toast.error("Montant invalide");

    setSaving(true);
    try {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          label: label.trim(),
          client_id: task.client_id,
          task_id: task.id,
          amount: totalHT,
          billing_type: "forfait",
          status: "a_facturer",
        } as any)
        .select()
        .single();
      if (error || !invoice) {
        toast.error(error?.message ?? "Erreur");
        return;
      }
      toast.success("Brouillon enregistré dans Facturation");
      onCreated?.(invoice.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isPrefillMode = !!prefillInvoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Brouillon facture — à copier dans Tiime</DialogTitle>
          <DialogDescription>
            Remplis les champs ci-dessous, puis copie chaque valeur (icône <Copy className="inline h-3 w-3" />) dans
            Tiime. Le bouton « Ouvrir Tiime » t'amène directement au formulaire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Intitulé de la facture *</Label>
              <div className="flex items-center gap-1.5">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
                <CopyField value={label} label="Intitulé" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date d'émission</Label>
                <div className="flex items-center gap-1.5">
                  <Input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="JJ/MM/AAAA" />
                  <CopyField value={issueDate} label="Date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Règlement</Label>
                <div className="flex items-center gap-1.5">
                  <Select value={payment} onValueChange={setPayment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="à réception">à réception</SelectItem>
                      <SelectItem value="15 jours">15 jours</SelectItem>
                      <SelectItem value="30 jours">30 jours</SelectItem>
                      <SelectItem value="45 jours">45 jours</SelectItem>
                      <SelectItem value="60 jours">60 jours</SelectItem>
                    </SelectContent>
                  </Select>
                  <CopyField value={payment} label="Règlement" />
                </div>
              </div>
            </div>
            {clientName && (
              <div className="text-xs text-muted-foreground bg-secondary/40 rounded px-3 py-2 flex items-center justify-between">
                <span>Client : <span className="font-medium text-foreground">{clientName}</span></span>
                <CopyField value={clientName} label="Client" />
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Lignes</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addLine} className="h-7 gap-1">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((l, idx) => {
                const ht = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                return (
                  <div key={idx} className="border rounded-md p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-muted-foreground">Ligne {idx + 1}</div>
                      <div className="ml-auto text-xs tabular-nums font-medium">{fmtMoney(ht)} HT</div>
                      {lines.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Catégorie</Label>
                        <div className="flex items-center gap-1">
                          <Select value={l.category} onValueChange={(v: any) => updateLine(idx, { category: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Presta">Presta</SelectItem>
                              <SelectItem value="Bien">Bien</SelectItem>
                            </SelectContent>
                          </Select>
                          <CopyField value={l.category} label="Catégorie" />
                        </div>
                      </div>
                      <div className="col-span-9 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Désignation</Label>
                        <div className="flex items-center gap-1">
                          <Input value={l.designation} onChange={(e) => updateLine(idx, { designation: e.target.value })} />
                          <CopyField value={l.designation} label="Désignation" />
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Qté</Label>
                        <div className="flex items-center gap-1">
                          <Input type="number" step="0.01" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                          <CopyField value={l.quantity} label="Quantité" />
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Unité</Label>
                        <div className="flex items-center gap-1">
                          <Input value={l.unit} onChange={(e) => updateLine(idx, { unit: e.target.value })} placeholder="u, h…" />
                          <CopyField value={l.unit} label="Unité" />
                        </div>
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Prix unitaire HT (€)</Label>
                        <div className="flex items-center gap-1">
                          <Input type="number" step="0.01" value={l.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                          <CopyField value={l.unit_price} label="PU" />
                        </div>
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">TVA (%)</Label>
                        <div className="flex items-center gap-1">
                          <Select value={l.vat} onValueChange={(v) => updateLine(idx, { vat: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 %</SelectItem>
                              <SelectItem value="5.5">5,5 %</SelectItem>
                              <SelectItem value="10">10 %</SelectItem>
                              <SelectItem value="20">20 %</SelectItem>
                            </SelectContent>
                          </Select>
                          <CopyField value={l.vat} label="TVA" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-md border bg-secondary/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="tabular-nums">{fmtMoney(totalHT)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{fmtMoney(totalTVA)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t"><span>Total TTC</span><span className="tabular-nums">{fmtMoney(totalTTC)}</span></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={copyAll} className="gap-1.5">
              <ClipboardCopy className="h-3.5 w-3.5" /> Tout copier
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open("https://apps.tiime.fr", "_blank")}
              className="gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir Tiime
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {isPrefillMode ? "Fermer" : "Annuler"}
          </Button>
          {!isPrefillMode && task && (
            <Button onClick={saveInvoice} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer dans Facturation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
