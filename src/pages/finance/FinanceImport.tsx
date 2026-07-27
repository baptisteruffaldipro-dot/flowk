import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceNav from "@/components/finance/FinanceNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { autoDetectMapping, CANONICAL_LABELS, CanonicalField, categorize, ColumnMapping, dedupeKey, headersSignature, normalizeCounterparty, normalizeRow, parseFile } from "@/lib/finance/parseTiime";
import { Upload, FileSpreadsheet, RotateCcw, CheckCircle2, Wand2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Kind = "sale" | "expense" | "bank";

function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthToDate(m: string) { return `${m}-01`; }
function fmtMonth(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function FinanceImport() {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind>("sale");
  const [periodMonth, setPeriodMonth] = useState<string>(currentMonthISO());
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [imports, setImports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [makeReceivables, setMakeReceivables] = useState(true);

  const loadImports = async () => {
    const { data } = await supabase.from("tiime_imports").select("*").order("created_at", { ascending: false }).limit(20);
    setImports(data ?? []);
  };
  useEffect(() => { loadImports(); }, []);

  const onFile = async (f: File) => {
    setFile(f);
    const parsed = await parseFile(f);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const sig = headersSignature(parsed.headers);
    const { data: saved } = await supabase.from("tiime_column_mappings").select("*").eq("kind", kind).eq("headers_signature", sig).maybeSingle();
    const auto = autoDetectMapping(parsed.headers);
    const savedMap = (saved?.mapping as ColumnMapping) ?? {};
    // Merge: saved wins when explicit, but auto fills any column still on "ignore".
    const merged: ColumnMapping = { ...auto };
    for (const h of parsed.headers) {
      if (savedMap[h] && savedMap[h] !== "ignore") merged[h] = savedMap[h];
    }
    setMapping(merged);
  };

  const redetect = () => {
    if (headers.length === 0) return;
    setMapping(autoDetectMapping(headers));
    toast.success("Colonnes ré-associées automatiquement");
  };

  const runImport = async () => {
    if (!file || rows.length === 0) return;
    setBusy(true);
    try {
      const sig = headersSignature(headers);
      await supabase.from("tiime_column_mappings").upsert(
        { profile_name: "default", kind, mapping: mapping as any, headers_signature: sig },
        { onConflict: "profile_name,kind" },
      );

      const user = (await supabase.auth.getUser()).data.user;
      const { data: imp, error: impErr } = await supabase.from("tiime_imports")
        .insert({ filename: file.name, imported_by: user?.id, row_count: rows.length, status: "pending", period_month: monthToDate(periodMonth) } as any)
        .select().single();
      if (impErr) throw impErr;

      const [rulesRes, clientsRes, linkRulesRes] = await Promise.all([
        supabase.from("finance_category_rules").select("*").eq("active", true),
        supabase.from("clients").select("id, name"),
        supabase.from("finance_link_rules").select("*"),
      ]);
      const rules = (rulesRes.data ?? []) as any[];
      const clients = (clientsRes.data ?? []) as any[];
      const linkRules = (linkRulesRes.data ?? []) as any[];
      const linkMap = new Map<string, any>(linkRules.map((r) => [r.counterparty_normalized as string, r]));
      const clientByNorm = new Map<string, string>(clients.map((c) => [normalizeCounterparty(c.name), c.id as string]));

      const { data: existingInvoices } = await supabase.from("invoices").select("id, tiime_invoice_id");
      const invByNumber = new Map<string, string>(
        ((existingInvoices ?? []) as any[]).filter((i) => i.tiime_invoice_id).map((i) => [String(i.tiime_invoice_id), i.id as string]),
      );

      let inserted = 0, duplicates = 0;
      let latestBank: { date: string; amount: number } | null = null;
      let bankNetMovement = 0;
      let bankMaxDate: string | null = null;
      // Factures de vente non réglées → dettes clients (agrégées par client)
      const unpaidByClient = new Map<string, { total: number; due: string | null; label: string }>();
      let unpaidUnmatched = 0;

      for (const row of rows) {
        const n = normalizeRow(row, mapping);
        if (n.bank_balance != null && n.date) {
          if (!latestBank || n.date > latestBank.date) latestBank = { date: n.date, amount: n.bank_balance };
        }
        if (!n.date) continue;
        if (kind === "bank") {
          bankNetMovement += Number(n.amount_ttc || 0);
          if (!bankMaxDate || n.date > bankMaxDate) bankMaxDate = n.date;
        }

        const cat = categorize(kind, n, rules as any);
        const norm = normalizeCounterparty(n.counterparty);
        const link = linkMap.get(norm);
        const client_id = link?.client_id ?? clientByNorm.get(norm) ?? null;
        const invoice_id = n.doc_number ? invByNumber.get(n.doc_number) ?? null : null;

        const payload = {
          import_id: imp.id,
          source: "tiime_import",
          kind, category: cat.category, category_source: cat.source,
          doc_number: n.doc_number, date: n.date, due_date: n.due_date, paid_date: n.paid_date,
          label: n.label, counterparty: n.counterparty, counterparty_normalized: norm || null,
          amount_ht: n.amount_ht, vat_amount: n.vat_amount, amount_ttc: n.amount_ttc,
          vat_rate: n.vat_rate, account_code: n.account_code, supplier_cost_ht: n.supplier_cost_ht,
          client_id, project_id: link?.project_id ?? null, task_id: link?.task_id ?? null,
          invoice_id, raw: n.raw as any, dedupe_key: dedupeKey(kind, n),
        };
        const { error } = await supabase.from("finance_transactions").insert(payload as any);
        if (error) {
          if (String(error.message).toLowerCase().includes("duplicate")) duplicates++;
          else console.error("insert error", error);
        } else {
          inserted++;
          if (invoice_id) await supabase.from("invoices").update({ tiime_synced_at: new Date().toISOString() }).eq("id", invoice_id);
        }

        if (kind === "sale" && makeReceivables && !n.paid_date && Number(n.amount_ttc || 0) > 0) {
          if (client_id) {
            const cur = unpaidByClient.get(client_id) ?? { total: 0, due: null as string | null, label: n.counterparty || "" };
            cur.total += Number(n.amount_ttc || 0);
            if (n.due_date && (!cur.due || n.due_date < cur.due)) cur.due = n.due_date;
            unpaidByClient.set(client_id, cur);
          } else {
            unpaidUnmatched++;
          }
        }
      }

      // Écriture des dettes clients issues de l'import (remplace les précédentes non soldées d'origine import)
      if (unpaidByClient.size > 0) {
        const today = new Date().toISOString().slice(0, 10);
        for (const [cid, v] of unpaidByClient) {
          await supabase.from("client_receivables").delete().eq("client_id", cid).eq("notes", "import_tiime").neq("status", "paye");
          await (supabase as any).from("client_receivables").insert({
            client_id: cid,
            snapshot_date: today,
            invoiced_ttc: Number(v.total.toFixed(2)),
            paid_ttc: 0,
            outstanding_ttc: Number(v.total.toFixed(2)),
            expected_payment_date: v.due,
            status: v.due && v.due >= today ? "a_venir" : "en_retard",
            notes: "import_tiime",
          });
        }
      }

      if (latestBank) {
        await supabase.from("bank_balances").insert({
          as_of_date: latestBank.date, amount: latestBank.amount, source: "tiime_import", import_id: imp.id,
        });
      } else if (kind === "bank" && bankMaxDate && bankNetMovement !== 0) {
        // No "solde" column in the statement — compute snapshot from previous balance + net movement
        const { data: prev } = await supabase
          .from("bank_balances")
          .select("amount")
          .lte("as_of_date", bankMaxDate)
          .order("as_of_date", { ascending: false })
          .limit(1);
        const start = Number(prev?.[0]?.amount ?? 0);
        await supabase.from("bank_balances").insert({
          as_of_date: bankMaxDate,
          amount: start + bankNetMovement,
          source: "tiime_import",
          import_id: imp.id,
          note: `Calculé depuis ${inserted} mouvements (net ${bankNetMovement.toFixed(2)} €)`,
        });
      }

      await supabase.from("tiime_imports").update({
        status: "completed", inserted_count: inserted, duplicate_count: duplicates,
      }).eq("id", imp.id);

      toast.success(
        `Import terminé : ${inserted} lignes ajoutées, ${duplicates} doublons ignorés.` +
          (unpaidByClient.size > 0 ? ` ${unpaidByClient.size} dette(s) client créée(s).` : "") +
          (unpaidUnmatched > 0 ? ` ${unpaidUnmatched} facture(s) non réglée(s) sans client reconnu.` : ""),
      );
      setFile(null); setRows([]); setHeaders([]); setMapping({});
      loadImports();
    } catch (e: any) {
      toast.error(`Erreur import : ${e.message}`);
    } finally { setBusy(false); }
  };

  const rollback = async (id: string) => {
    if (!confirm("Annuler cet import ? Les lignes correspondantes seront supprimées.")) return;
    await supabase.from("finance_transactions").delete().eq("import_id", id);
    await supabase.from("bank_balances").delete().eq("import_id", id);
    await supabase.from("tiime_imports").update({ status: "rolled_back", rolled_back_at: new Date().toISOString() }).eq("id", id);
    toast.success("Import annulé");
    loadImports();
  };

  const canonicalFields: CanonicalField[] = ["ignore","date","due_date","paid_date","doc_number","label","counterparty","amount_ht","vat_amount","amount_ttc","debit","credit","vat_rate","account_code","supplier_cost_ht","bank_balance"];
  const unknown = headers.filter((h) => !mapping[h] || mapping[h] === "ignore").length;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Import Tiime" description="Importe tes exports mois par mois (Excel/CSV). Le mapping des colonnes est mémorisé pour la prochaine fois." />
      <FinanceNav />

      <Card className="p-5 mb-6">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            <TabsTrigger value="sale">Factures de vente</TabsTrigger>
            <TabsTrigger value="expense">Factures d'achat / dépenses</TabsTrigger>
            <TabsTrigger value="bank">Mouvements bancaires</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="period" className="text-sm">Mois de l'import</Label>
            <Input id="period" type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="w-[170px] h-9" />
          </div>
          <Label htmlFor="file" className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 border border-dashed rounded-md hover:bg-secondary/40">
            <Upload className="h-4 w-4" /> Choisir un fichier .xlsx / .csv
          </Label>
          <Input id="file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {file && <div className="text-sm text-muted-foreground flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{file.name} · {rows.length} lignes</div>}
        </div>

        {headers.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Correspondance des colonnes</div>
              <div className="flex items-center gap-3">
                {unknown > 0 ? (
                  <div className="text-xs text-amber-600">{unknown} colonne(s) non associée(s)</div>
                ) : (
                  <div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Toutes les colonnes reconnues</div>
                )}
                <Button size="sm" variant="ghost" onClick={redetect} className="h-7 text-xs">
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> Ré-détecter
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground w-1/2 truncate" title={h}>{h}</div>
                  <Select value={mapping[h] ?? "ignore"} onValueChange={(v) => setMapping({ ...mapping, [h]: v as CanonicalField })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {canonicalFields.map((f) => <SelectItem key={f} value={f}>{CANONICAL_LABELS[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={runImport} disabled={busy}>{busy ? "Import en cours…" : "Lancer l'import"}</Button>
              <Button variant="ghost" onClick={() => { setFile(null); setRows([]); setHeaders([]); }}>Annuler</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Historique des imports</div>
        {imports.length === 0 && <div className="text-sm text-muted-foreground">Aucun import pour l'instant.</div>}
        <div className="divide-y">
          {imports.map((i) => (
            <div key={i.id} className="py-2 flex items-center gap-3 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{i.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {i.period_month && <span className="mr-1 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">{fmtMonth(i.period_month)}</span>}
                  {fmtDate(i.created_at)} · {i.inserted_count} ajoutées · {i.duplicate_count} doublons · {i.status}
                </div>
              </div>
              {i.status === "completed" && (
                <Button size="sm" variant="ghost" onClick={() => rollback(i.id)}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}