import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, INVOICE_STATUS_LABEL } from "@/lib/format";

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    label: "", client_id: "", status: "a_facturer",
    billing_type: "forfait", amount: "", hours: "", hourly_rate: "", questionnaire_id: "",
  });

  const load = async () => {
    const [i, c, q] = await Promise.all([
      supabase.from("invoices").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("questionnaires").select("id,title,client_id").order("created_at", { ascending: false }),
    ]);
    const qById = new Map(((q.data as any[]) ?? []).map((x) => [x.id, x]));
    const enriched = ((i.data as any[]) ?? []).map((row) => ({
      ...row,
      questionnaire: row.questionnaire_id ? qById.get(row.questionnaire_id) ?? null : null,
    }));
    setInvoices(enriched);
    setClients(c.data ?? []);
    setQuestionnaires((q.data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const t = { a_facturer: 0, facturee: 0, payee: 0 };
    invoices.forEach((i) => {
      const k = i.status as keyof typeof t;
      if (k in t) t[k] += Number(i.amount);
    });
    return t;
  }, [invoices]);

  const computedAmount = useMemo(() => {
    if (form.billing_type === "horaire" && form.hours && form.hourly_rate) {
      return Number(form.hours) * Number(form.hourly_rate);
    }
    return form.amount ? Number(form.amount) : 0;
  }, [form.billing_type, form.hours, form.hourly_rate, form.amount]);

  const filteredQuestionnaires = useMemo(
    () => form.client_id ? questionnaires.filter((q) => q.client_id === form.client_id) : questionnaires,
    [questionnaires, form.client_id],
  );

  const create = async () => {
    if (!form.label.trim() || !form.client_id) return toast.error("Libellé et client requis");
    if (computedAmount <= 0) return toast.error("Montant invalide");
    const { error } = await supabase.from("invoices").insert({
      label: form.label.trim(),
      client_id: form.client_id,
      amount: computedAmount,
      status: form.status,
      billing_type: form.billing_type,
      hours: form.billing_type === "horaire" && form.hours ? Number(form.hours) : null,
      hourly_rate: form.billing_type === "horaire" && form.hourly_rate ? Number(form.hourly_rate) : null,
      questionnaire_id: form.questionnaire_id || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Ajouté");
    setOpen(false);
    setForm({ label: "", client_id: "", status: "a_facturer", billing_type: "forfait", amount: "", hours: "", hourly_rate: "", questionnaire_id: "" });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "facturee") patch.invoiced_at = new Date().toISOString().slice(0, 10);
    if (status === "payee") patch.paid_at = new Date().toISOString().slice(0, 10);
    await supabase.from("invoices").update(patch).eq("id", id);
    load();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Facturation"
        description="Suivi simple des prestations"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={clients.length === 0}><Plus className="h-4 w-4 mr-1" /> Nouvelle ligne</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Nouvelle ligne de facturation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Libellé *</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex : Création logo, retouches photos…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, questionnaire_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="forfait">Forfait</SelectItem>
                        <SelectItem value="horaire">Horaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.billing_type === "horaire" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Heures</Label>
                        <Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Taux €/h</Label>
                        <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Montant (€) *</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    </div>
                  )}
                </div>
                {form.billing_type === "horaire" && (
                  <div className="text-xs text-muted-foreground bg-secondary/40 rounded px-3 py-2 flex items-center justify-between">
                    <span>Total calculé</span>
                    <span className="font-semibold tabular-nums text-foreground">{fmtMoney(computedAmount)}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs inline-flex items-center gap-1.5">
                    <Link2 className="h-3 w-3" /> Rattacher à un brief / questionnaire
                  </Label>
                  <Select
                    value={form.questionnaire_id || "none"}
                    onValueChange={(v) => setForm({ ...form, questionnaire_id: v === "none" ? "" : v })}
                    disabled={!form.client_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.client_id ? "Aucun" : "Choisir un client d'abord"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {filteredQuestionnaires.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Créer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">À facturer</div><div className="text-2xl font-semibold mt-2">{fmtMoney(totals.a_facturer)}</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">Facturé (en attente)</div><div className="text-2xl font-semibold mt-2">{fmtMoney(totals.facturee)}</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground uppercase tracking-wider">Payé</div><div className="text-2xl font-semibold mt-2 text-success">{fmtMoney(totals.payee)}</div></Card>
      </div>

      <Card className="overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Aucune ligne</div>
        ) : (
          <div className="divide-y">
            {invoices.map((i) => (
              <div key={i.id} className="grid grid-cols-12 gap-3 px-5 py-3 items-center text-sm">
                <div className="col-span-5 min-w-0">
                  <div className="font-medium truncate">{i.label}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-2 flex-wrap">
                    <span>{i.clients?.name}</span>
                    {i.questionnaire?.title && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <FileText className="h-2.5 w-2.5" /> {i.questionnaire.title}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {i.billing_type === "horaire" && i.hours
                    ? `${i.hours}h × ${fmtMoney(Number(i.hourly_rate ?? 0))}`
                    : <Badge variant="secondary" className="text-[10px]">Forfait</Badge>}
                </div>
                <div className="col-span-2 font-medium tabular-nums">{fmtMoney(Number(i.amount))}</div>
                <div className="col-span-3">
                  <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}