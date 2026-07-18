import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle2, Trash2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ClientOnboarding from "@/components/ClientOnboarding";
import { computeTaskBilling } from "@/lib/billing";
import { fmtMoney, displayEmail } from "@/lib/format";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [totalHT, setTotalHT] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<null | "email" | "phone" | "address">(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      setClient(c);
      const { data: tasks } = await supabase.from("tasks").select("*").eq("client_id", id);
      const list = tasks ?? [];
      setTaskCount(list.length);
      setTotalHT(list.reduce((s, t) => s + computeTaskBilling(t).total, 0));
    })();
  }, [id]);

  if (!client) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  const startEdit = (field: "email" | "phone" | "address") => {
    setEditing(field);
    setDraft(client[field] ?? "");
  };

  const saveField = async () => {
    if (!editing) return;
    setSaving(true);
    const value = draft.trim() === "" ? null : draft.trim();
    const payload: any = { [editing]: value };
    const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setClient({ ...client, [editing]: value });
    setEditing(null);
    toast.success("Mis à jour");
  };

  const invite = async () => {
    if (!client.email) return toast.error("Ajoutez d'abord un email au client");
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-client", { body: { client_id: client.id } });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'invitation");
      return;
    }
    toast.success("Invitation envoyée par email");
    const { data: c } = await supabase.from("clients").select("*").eq("id", client.id).maybeSingle();
    setClient(c);
  };

  const resendInvite = async () => {
    if (!client.email) return toast.error("Email manquant");
    setResending(true);
    const { data, error } = await supabase.functions.invoke("invite-client", { body: { client_id: client.id, resend: true } });
    setResending(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec du renvoi");
      return;
    }
    toast.success("Invitation renvoyée par email");
  };

  const deleteClient = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const checks = await Promise.all([
        supabase.from("projects").select("id").eq("client_id", id).limit(1),
        supabase.from("tasks").select("id").eq("client_id", id).limit(1),
        supabase.from("print_orders").select("id").eq("client_id", id).limit(1),
        supabase.from("invoices").select("id").eq("client_id", id).limit(1),
        supabase.from("bats").select("id").eq("client_id", id).limit(1),
        supabase.from("appointments").select("id").eq("client_id", id).limit(1),
        supabase.from("questionnaires").select("id").eq("client_id", id).limit(1),
      ]);
      if (checks.some((r) => (r.data ?? []).length > 0)) {
        toast.error("Impossible : ce client a des projets, tâches, commandes, factures, BAT, RDV ou questionnaires associés.");
        setDeleting(false);
        return;
      }
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("Client supprimé");
      navigate("/clients");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <Link to="/clients" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Clients
      </Link>
      <PageHeader
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {client.portal_token && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const url = `${window.location.origin}/p/portail/${client.portal_token}`;
                  await navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  toast.success("Lien personnalisé copié");
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
              >
                {copiedLink ? <Check className="h-4 w-4 mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                {copiedLink ? "Copié" : "Copier le lien portail"}
              </Button>
            )}
            {client.portal_user_id ? (
              <>
                <span className="text-xs inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Portail activé
                </span>
                <Button size="sm" variant="outline" onClick={resendInvite} disabled={resending}>
                  <Mail className="h-4 w-4 mr-1" /> {resending ? "Envoi…" : "Renvoyer l'accès au portail"}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={invite} disabled={inviting || !client.email}>
                <Mail className="h-4 w-4 mr-1" /> {inviting ? "Envoi…" : "Créer l'accès au portail"}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Action définitive. Le client doit n'avoir aucun projet, tâche, commande, facture, BAT, RDV ou questionnaire associé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteClient} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? "Suppression…" : "Supprimer"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <EditableCard label="Email" field="email" value={displayEmail(client.email)}
          editing={editing === "email"} draft={draft} setDraft={setDraft} saving={saving}
          onStart={() => startEdit("email")} onSave={saveField} onCancel={() => setEditing(null)} type="email" />
        <EditableCard label="Téléphone" field="phone" value={client.phone}
          editing={editing === "phone"} draft={draft} setDraft={setDraft} saving={saving}
          onStart={() => startEdit("phone")} onSave={saveField} onCancel={() => setEditing(null)} type="tel" />
        <EditableCard label="Adresse" field="address" value={client.address}
          editing={editing === "address"} draft={draft} setDraft={setDraft} saving={saving}
          onStart={() => startEdit("address")} onSave={saveField} onCancel={() => setEditing(null)} />
      </div>

      <Card className="p-5 mb-6 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Solde total CA HT</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{taskCount} tâche(s) · estimé toutes tâches confondues</div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{fmtMoney(totalHT)}</div>
        </div>
      </Card>

      <ClientOnboarding clientId={client.id} mode="admin" />
    </div>
  );
}

function EditableCard({
  label, value, editing, draft, setDraft, saving, onStart, onSave, onCancel, type,
}: {
  label: string; field: string; value: string | null;
  editing: boolean; draft: string; setDraft: (s: string) => void; saving: boolean;
  onStart: () => void; onSave: () => void; onCancel: () => void; type?: string;
}) {
  return (
    <Card className="p-4 cursor-pointer" onClick={() => { if (!editing) onStart(); }}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <Input
            autoFocus
            type={type ?? "text"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={onSave} disabled={saving}>OK</Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>×</Button>
        </div>
      ) : (
        <div className="text-sm mt-1">{value || "—"}</div>
      )}
    </Card>
  );
}