import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import TxSplitEditor, { saveTxSplits, type SplitDraft } from "@/components/finance/TxSplitEditor";

type Kind = "sale" | "expense" | "bank";
type Category = "prestation" | "achat_revente" | "expense" | "frais_fixe" | "bank" | "other";

export type TxRow = {
  id?: string;
  kind: Kind;
  category: Category;
  date: string;
  due_date?: string | null;
  paid_date?: string | null;
  doc_number?: string | null;
  label?: string | null;
  counterparty?: string | null;
  amount_ht?: number;
  vat_amount?: number;
  amount_ttc?: number;
  vat_rate?: number | null;
  supplier_cost_ht?: number | null;
  client_id?: string | null;
  project_id?: string | null;
  business_unit_id?: string | null;
};

const empty = (kind: Kind): TxRow => ({
  kind,
  category: kind === "sale" ? "prestation" : kind === "expense" ? "expense" : "bank",
  date: new Date().toISOString().slice(0, 10),
  amount_ht: 0,
  vat_amount: 0,
  amount_ttc: 0,
});

export default function TransactionDialog({
  open,
  onOpenChange,
  kind,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Kind;
  initial?: TxRow | null;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<TxRow>(empty(kind));
  const { activeUnits } = useBusinessUnits();
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [splits, setSplits] = useState<SplitDraft[]>([]);

  useEffect(() => {
    if (open) { setRow(initial ? { ...initial } : empty(kind)); setSplits([]); }
  }, [open, initial, kind]);

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("projects").select("id, name").order("name"),
      ]);
      setClients(c.data ?? []);
      setProjects(p.data ?? []);
    })();
  }, []);

  const setField = (k: keyof TxRow, v: any) => setRow((r) => ({ ...r, [k]: v }));

  const recalcTTC = (ht: number, tva: number) => setField("amount_ttc", Number((ht + tva).toFixed(2)));

  const save = async () => {
    if (!row.date) return toast.error("Date obligatoire");
    setSaving(true);
    const payload: any = {
      kind: row.kind,
      category: row.category,
      date: row.date,
      due_date: row.due_date || null,
      paid_date: row.paid_date || null,
      doc_number: row.doc_number || null,
      label: row.label || null,
      counterparty: row.counterparty || null,
      amount_ht: Number(row.amount_ht) || 0,
      vat_amount: Number(row.vat_amount) || 0,
      amount_ttc: Number(row.amount_ttc) || 0,
      vat_rate: row.vat_rate != null && !isNaN(Number(row.vat_rate)) ? Number(row.vat_rate) : null,
      supplier_cost_ht: row.supplier_cost_ht != null && !isNaN(Number(row.supplier_cost_ht)) ? Number(row.supplier_cost_ht) : null,
      client_id: row.client_id || null,
      project_id: row.project_id || null,
      business_unit_id: row.business_unit_id || null,
      source: "manual",
      category_source: "manual",
    };
    let error: any;
    let savedId = row.id;
    if (row.id) ({ error } = await supabase.from("finance_transactions").update(payload).eq("id", row.id));
    else {
      const res = await supabase.from("finance_transactions").insert(payload).select("id").single();
      error = res.error;
      savedId = res.data?.id;
    }
    if (!error && savedId) await saveTxSplits(savedId, splits);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(row.id ? "Ligne modifiée" : "Ligne ajoutée");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!row.id) return;
    if (!confirm("Supprimer cette ligne ?")) return;
    const { error } = await supabase.from("finance_transactions").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Ligne supprimée");
    onOpenChange(false);
    onSaved();
  };

  const isSale = row.kind === "sale";
  const isExpense = row.kind === "expense";
  const isBank = row.kind === "bank";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row.id ? "Modifier" : "Ajouter"} — {isSale ? "Facture de vente" : isExpense ? "Dépense" : "Mouvement bancaire"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={row.date ?? ""} onChange={(e) => setField("date", e.target.value)} /></Field>
          {!isBank && (
            <Field label="Catégorie">
              <Select value={row.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isSale && <SelectItem value="prestation">Prestation</SelectItem>}
                  {isSale && <SelectItem value="achat_revente">Achat / Revente</SelectItem>}
                  {isExpense && <SelectItem value="expense">Dépense</SelectItem>}
                  {isExpense && <SelectItem value="frais_fixe">Frais fixe (récurrent)</SelectItem>}
                  {isExpense && <SelectItem value="achat_revente">Achat (revente)</SelectItem>}
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {!isBank && (
            <Field label={isSale ? "Client" : "Fournisseur"}>
              <Input value={row.counterparty ?? ""} onChange={(e) => setField("counterparty", e.target.value)} />
            </Field>
          )}
          {!isBank && (
            <Field label="N° de pièce">
              <Input value={row.doc_number ?? ""} onChange={(e) => setField("doc_number", e.target.value)} />
            </Field>
          )}
          <Field label={isBank ? "Libellé" : "Description"} className="sm:col-span-2">
            <Textarea rows={2} value={row.label ?? ""} onChange={(e) => setField("label", e.target.value)} />
          </Field>

          {!isBank && (
            <>
              <Field label="Montant HT">
                <Input type="number" step="0.01" value={row.amount_ht ?? 0}
                  onChange={(e) => { const v = Number(e.target.value); setField("amount_ht", v); recalcTTC(v, Number(row.vat_amount) || 0); }} />
              </Field>
              <Field label="TVA">
                <Input type="number" step="0.01" value={row.vat_amount ?? 0}
                  onChange={(e) => { const v = Number(e.target.value); setField("vat_amount", v); recalcTTC(Number(row.amount_ht) || 0, v); }} />
              </Field>
              <Field label="Montant TTC">
                <Input type="number" step="0.01" value={row.amount_ttc ?? 0} onChange={(e) => setField("amount_ttc", Number(e.target.value))} />
              </Field>
              <Field label="Taux TVA (%)">
                <Input type="number" step="0.1" value={row.vat_rate ?? ""} onChange={(e) => setField("vat_rate", e.target.value === "" ? null : Number(e.target.value))} />
              </Field>
              <Field label="Date d'échéance">
                <Input type="date" value={row.due_date ?? ""} onChange={(e) => setField("due_date", e.target.value || null)} />
              </Field>
              <Field label="Date de paiement">
                <Input type="date" value={row.paid_date ?? ""} onChange={(e) => setField("paid_date", e.target.value || null)} />
              </Field>
              {isExpense && (
                <Field label="Nature">
                  <Select value={row.category === "frais_fixe" ? "frais_fixe" : row.category === "achat_revente" ? "achat_revente" : "expense"} onValueChange={(v) => setField("category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Ponctuelle</SelectItem>
                      <SelectItem value="frais_fixe">Récurrente (frais fixe)</SelectItem>
                      <SelectItem value="achat_revente">Achat / investissement</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {row.category === "achat_revente" && (
                <Field label="Coût d'achat HT (fournisseur)">
                  <Input type="number" step="0.01" value={row.supplier_cost_ht ?? ""} onChange={(e) => setField("supplier_cost_ht", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
              )}
            </>
          )}

          {isBank && (
            <Field label="Montant (signé : + entrée / − sortie)">
              <Input type="number" step="0.01" value={row.amount_ttc ?? 0}
                onChange={(e) => { const v = Number(e.target.value); setField("amount_ttc", v); setField("amount_ht", v); }} />
            </Field>
          )}

          <Field label="Client (lien)">
            <Select value={row.client_id ?? "none"} onValueChange={(v) => setField("client_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pôle d'activité">
            <Select value={row.business_unit_id ?? "none"} onValueChange={(v) => setField("business_unit_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Global / commun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Global / commun</SelectItem>
                {activeUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {!isBank && (
            <TxSplitEditor
              transactionId={row.id}
              amountHt={Number(row.amount_ht) || 0}
              value={splits}
              onChange={setSplits}
            />
          )}
          <Field label="Projet (lien)">
            <Select value={row.project_id ?? "none"} onValueChange={(v) => setField("project_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>{row.id && <Button variant="destructive" size="sm" onClick={remove}>Supprimer</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}