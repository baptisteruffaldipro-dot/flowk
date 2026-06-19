import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClientSelectField from "@/components/ClientSelectField";
import { Plus, Link2, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

type Req = any;
type ClientLite = { id: string; name: string; company?: string | null };

const KIND_LABEL: Record<string, string> = {
  projet: "Projet", tache: "Tâche", commande: "Commande", rdv: "Rendez-vous", autre: "Autre",
};
const PRESTATION_LABEL: Record<string, string> = {
  logo: "Logo", refonte: "Refonte", ajustements: "Ajustements",
  conception_graphique: "Conception graphique", illustration: "Illustration",
  impression: "Impression", autre: "Autre",
};
const STATUS_LABEL: Record<string, string> = {
  nouveau: "Nouveau", en_attente_client: "En attente client", validee: "Validée",
  refusee: "Refusée", convertie: "Convertie", annulee: "Annulée",
};
const STATUS_CLASS: Record<string, string> = {
  nouveau: "bg-sky-500/15 text-sky-300",
  en_attente_client: "bg-amber-500/15 text-amber-300",
  validee: "bg-emerald-500/15 text-emerald-300",
  refusee: "bg-rose-500/15 text-rose-300",
  convertie: "bg-violet-500/15 text-violet-300",
  annulee: "bg-muted text-muted-foreground",
};

export default function ClientRequests() {
  const [items, setItems] = useState<Req[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Req | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: cs }] = await Promise.all([
      supabase.from("client_requests" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name,company").order("name"),
    ]);
    setItems((reqs as any) ?? []);
    setClients((cs as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => filter === "all" ? items : items.filter((i) => i.status === filter),
    [items, filter],
  );

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/p/demande/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Demandes clients"
        description="Centralise les demandes entrantes et envoie un récap’ au client."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nouvelle demande
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {(["all","nouveau","en_attente_client","validee","refusee","convertie"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              filter === s ? "bg-secondary text-foreground border-border" : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Toutes" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border/60 rounded-lg p-8 text-center">
          Aucune demande pour ce filtre.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_CLASS[r.status] ?? ""}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  {r.prestation_type && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-secondary text-foreground">
                      {PRESTATION_LABEL[r.prestation_type] ?? r.prestation_type}
                    </span>
                  )}
                  <button
                    onClick={() => { setEditing(r); setOpen(true); }}
                    className="font-medium text-left truncate hover:underline"
                  >
                    {r.title}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {r.client_name_snapshot || clients.find((c) => c.id === r.client_id)?.name || "—"}
                  {r.deadline && <> · échéance {new Date(r.deadline).toLocaleDateString("fr-FR")}</>}
                  {r.estimated_amount && <> · {Number(r.estimated_amount).toFixed(0)} €</>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyLink(r.share_token)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copier le lien
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/p/demande/${r.share_token}`} target="_blank">
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Aperçu
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RequestDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        clients={clients}
        onClientCreated={(c) => setClients((p) => [c, ...p])}
        onSaved={load}
      />
    </div>
  );
}

function RequestDialog({
  open, onOpenChange, editing, clients, onClientCreated, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Req | null;
  clients: ClientLite[];
  onClientCreated: (c: ClientLite) => void;
  onSaved: () => void;
}) {
  const empty = {
    client_id: "", client_name_snapshot: "", prestation_type: "logo", kind: "projet",
    title: "", description: "",
    billing_type: "a_definir", estimated_amount: "", estimated_hours: "", hourly_rate: "",
    deadline: "", status: "nouveau",
  };
  const [form, setForm] = useState<any>(empty);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        client_id: editing.client_id || "",
        client_name_snapshot: editing.client_name_snapshot || "",
        prestation_type: editing.prestation_type || "logo",
        kind: editing.kind || "projet",
        title: editing.title || "",
        description: editing.description || "",
        billing_type: editing.billing_type || "a_definir",
        estimated_amount: editing.estimated_amount ?? "",
        estimated_minutes: editing.estimated_minutes ?? "",
        hourly_rate: editing.hourly_rate ?? "",
        deadline: editing.deadline || "",
        status: editing.status || "nouveau",
      });
      supabase
        .from("client_request_messages" as any)
        .select("*")
        .eq("request_id", editing.id)
        .order("created_at")
        .then(({ data }) => setMessages((data as any) ?? []));
    } else {
      setForm(empty);
      setMessages([]);
    }
    setNewMessage("");
  }, [open, editing]);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    setBusy(true);
    const estimated_amount =
      form.billing_type === "horaire"
        ? ((Number(form.estimated_minutes) || 0) / 60) * (Number(form.hourly_rate) || 0)
        : form.estimated_amount === ""
          ? null
          : Number(form.estimated_amount);
    const payload: any = {
      client_id: form.client_id || null,
      client_name_snapshot:
        form.client_name_snapshot || clients.find((c) => c.id === form.client_id)?.name || null,
      prestation_type: form.prestation_type,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      billing_type: form.billing_type,
      estimated_amount: estimated_amount || null,
      estimated_minutes: form.estimated_minutes === "" ? null : Number(form.estimated_minutes),
      hourly_rate: form.hourly_rate === "" ? null : Number(form.hourly_rate),
      deadline: form.deadline || null,
      status: form.status,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("client_requests" as any).update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("client_requests" as any).insert(payload));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Demande mise à jour" : "Demande créée");
    onSaved();
    onOpenChange(false);
  };

  const sendMessage = async () => {
    if (!editing || !newMessage.trim()) return;
    const { error } = await supabase
      .from("client_request_messages" as any)
      .insert({ request_id: editing.id, author: "admin", body: newMessage.trim() });
    if (error) return toast.error(error.message);
    setNewMessage("");
    const { data } = await supabase
      .from("client_request_messages" as any)
      .select("*")
      .eq("request_id", editing.id)
      .order("created_at");
    setMessages((data as any) ?? []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Demande client" : "Nouvelle demande client"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Titre *</Label>
            <Input
              autoFocus value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex. Refonte logo + carte de visite"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type de prestation</Label>
            <Select value={form.prestation_type} onValueChange={(v) => setForm({ ...form, prestation_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRESTATION_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="projet">Projet</SelectItem>
                <SelectItem value="tache">Tâche</SelectItem>
                <SelectItem value="commande">Commande</SelectItem>
                <SelectItem value="rdv">Rendez-vous</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Client</Label>
            <ClientSelectField
              value={form.client_id}
              onChange={(id) => setForm({ ...form, client_id: id })}
              clients={clients}
              onClientCreated={onClientCreated}
              showCompany
            />
          </div>

          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Détails de la demande, contexte, références…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Facturation</Label>
            <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="forfait">Forfait</SelectItem>
                <SelectItem value="horaire">Horaire</SelectItem>
                <SelectItem value="a_definir">À définir</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Deadline</Label>
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>

          {form.billing_type === "forfait" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Montant estimé (€)</Label>
              <Input
                type="number" step="0.01" value={form.estimated_amount}
                onChange={(e) => setForm({ ...form, estimated_amount: e.target.value })}
              />
            </div>
          )}
          {form.billing_type === "horaire" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Durée estimée (min)</Label>
                <Input
                  type="number" value={form.estimated_minutes}
                  onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire (€)</Label>
                <Input
                  type="number" step="0.01" value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Prix total estimé</Label>
                <div className="text-sm font-semibold">
                  {(() => {
                    const m = Number(form.estimated_minutes) || 0;
                    const r = Number(form.hourly_rate) || 0;
                    const total = (m / 60) * r;
                    return total > 0 ? `${total.toFixed(2)} € HT` : "—";
                  })()}
                </div>
              </div>
            </>
          )}

          {editing && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {editing && (
          <div className="border-t border-border/60 pt-4 mt-2 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Échanges</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-xs text-muted-foreground">Aucun message pour le moment.</div>
              ) : messages.map((m) => (
                <div key={m.id} className={`text-sm p-2 rounded-md ${m.author === "admin" ? "bg-secondary" : "bg-muted"}`}>
                  <div className="text-[10px] uppercase text-muted-foreground mb-0.5">
                    {m.author === "admin" ? "Vous" : "Client"} · {new Date(m.created_at).toLocaleString("fr-FR")}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Répondre au client…"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
              />
              <Button type="button" onClick={sendMessage} disabled={!newMessage.trim()}>Envoyer</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={save} disabled={busy}>
            {editing ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}