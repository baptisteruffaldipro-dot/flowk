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
import { Plus, FileText, Link2, Pencil, Trash2, CalendarClock, ClipboardCopy } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { fmtMoney, INVOICE_STATUS_LABEL } from "@/lib/format";
import InstallmentsManager from "@/components/InstallmentsManager";
import NewTiimeInvoiceDialog from "@/components/NewTiimeInvoiceDialog";

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [installmentsFor, setInstallmentsFor] = useState<any | null>(null);
  const [draftFor, setDraftFor] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    label: "", client_id: "", status: "a_facturer",
    billing_type: "forfait", amount: "", hours: "", hourly_rate: "", questionnaire_id: "",
  });

  const load = async () => {
    const [i, c, q, ins] = await Promise.all([
      supabase.from("invoices").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("questionnaires").select("id,title,client_id").order("created_at", { ascending: false }),
      supabase.from("invoice_installments").select("invoice_id,amount,paid_amount,paid_at,due_date"),
    ]);
    const qById = new Map(((q.data as any[]) ?? []).map((x) => [x.id, x]));
    const insByInvoice = new Map<string, any[]>();
    ((ins.data as any[]) ?? []).forEach((r) => {
      const arr = insByInvoice.get(r.invoice_id) ?? [];
      arr.push(r);
      insByInvoice.set(r.invoice_id, arr);
    });
    const enriched = ((i.data as any[]) ?? []).map((row) => ({
      ...row,
      questionnaire: row.questionnaire_id ? qById.get(row.questionnaire_id) ?? null : null,
      installments: insByInvoice.get(row.id) ?? [],
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

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.label?.trim() || !editing.client_id) return toast.error("Libellé et client requis");
    const amount = editing.billing_type === "horaire" && editing.hours && editing.hourly_rate
      ? Number(editing.hours) * Number(editing.hourly_rate)
      : Number(editing.amount);
    if (!amount || amount <= 0) return toast.error("Montant invalide");
    const { error } = await supabase.from("invoices").update({
      label: editing.label.trim(),
      client_id: editing.client_id,
      billing_type: editing.billing_type,
      amount,
      hours: editing.billing_type === "horaire" && editing.hours ? Number(editing.hours) : null,
      hourly_rate: editing.billing_type === "horaire" && editing.hourly_rate ? Number(editing.hourly_rate) : null,
      questionnaire_id: editing.questionnaire_id || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Mis à jour");
    setEditing(null);
    load();
  };

  const removeInvoice = async (id: string) => {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    load();
  };

  const openDraft = (invoice: any) => {
    setDraftFor({
      // shape compatible avec le dialog (task-like)
      id: invoice.id,
      title: invoice.label,
      client_id: invoice.client_id,
      billing_type: invoice.billing_type ?? "forfait",
      flat_amount: Number(invoice.amount ?? 0),
      hourly_rate: invoice.hourly_rate ?? null,
      total_minutes: invoice.hours ? Number(invoice.hours) * 60 : 0,
      _invoice: { id: invoice.id, label: invoice.label, amount: Number(invoice.amount ?? 0) },
    });
  };

  const editFilteredQuestionnaires = editing?.client_id
    ? questionnaires.filter((q) => q.client_id === editing.client_id)
    : questionnaires;

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
                    {i.installments?.length > 0 && (() => {
                      const paid = i.installments.reduce((s: number, x: any) => s + Number(x.paid_amount), 0);
                      const total = Number(i.amount);
                      const today = new Date().toISOString().slice(0,10);
                      const overdue = i.installments.filter((x: any) => !x.paid_at && x.due_date < today).length;
                      return (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <CalendarClock className="h-2.5 w-2.5" />
                          {fmtMoney(paid)} / {fmtMoney(total)}
                          {overdue > 0 && <span className="text-destructive">· {overdue} en retard</span>}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {i.billing_type === "horaire" && i.hours
                    ? `${i.hours}h × ${fmtMoney(Number(i.hourly_rate ?? 0))}`
                    : <Badge variant="secondary" className="text-[10px]">Forfait</Badge>}
                </div>
                <div className="col-span-2 font-medium tabular-nums">{fmtMoney(Number(i.amount))}</div>
                <div className="col-span-3 flex items-center gap-1">
                  <Select value={i.status} onValueChange={(v) => updateStatus(i.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {i.tiime_invoice_id ? (
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-emerald-600"
                      title="Voir dans Tiime"
                      onClick={() => window.open(`https://invoice.tiime.fr/invoices/${i.tiime_invoice_id}`, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      title="Créer dans Tiime"
                      disabled={syncingId === i.id}
                      onClick={() => sendToTiime(i)}
                    >
                      <Send className={`h-3.5 w-3.5 ${syncingId === i.id ? "animate-pulse" : ""}`} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 relative"
                    onClick={() => setInstallmentsFor(i)}
                    aria-label="Échéancier"
                    title="Échéancier"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    {i.installments?.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-primary text-primary-foreground rounded-full h-3.5 min-w-3.5 px-1 leading-none flex items-center justify-center">
                        {i.installments.length}
                      </span>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing({
                    ...i,
                    amount: i.amount ?? "",
                    hours: i.hours ?? "",
                    hourly_rate: i.hourly_rate ?? "",
                    questionnaire_id: i.questionnaire_id ?? "",
                  })} aria-label="Modifier">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" aria-label="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette ligne ?</AlertDialogTitle>
                        <AlertDialogDescription>« {i.label} » — {fmtMoney(Number(i.amount))}. Action irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeInvoice(i.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Modifier la ligne</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Libellé *</Label>
                <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client *</Label>
                <Select value={editing.client_id} onValueChange={(v) => setEditing({ ...editing, client_id: v, questionnaire_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={editing.billing_type} onValueChange={(v) => setEditing({ ...editing, billing_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forfait">Forfait</SelectItem>
                      <SelectItem value="horaire">Horaire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.billing_type === "horaire" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Heures</Label>
                      <Input type="number" step="0.25" value={editing.hours} onChange={(e) => setEditing({ ...editing, hours: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Taux €/h</Label>
                      <Input type="number" step="0.01" value={editing.hourly_rate} onChange={(e) => setEditing({ ...editing, hourly_rate: e.target.value })} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Montant (€) *</Label>
                    <Input type="number" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs inline-flex items-center gap-1.5">
                  <Link2 className="h-3 w-3" /> Rattacher à un brief / questionnaire
                </Label>
                <Select
                  value={editing.questionnaire_id || "none"}
                  onValueChange={(v) => setEditing({ ...editing, questionnaire_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {editFilteredQuestionnaires.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {installmentsFor && (
        <InstallmentsManager
          invoice={installmentsFor}
          open={!!installmentsFor}
          onOpenChange={(v) => { if (!v) setInstallmentsFor(null); }}
          onChanged={load}
        />
      )}
    </div>
  );
}