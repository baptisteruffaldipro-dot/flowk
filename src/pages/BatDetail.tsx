import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Upload, Send, CheckCircle2, XCircle, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import BatViewer from "@/components/BatViewer";
import { BAT_STATUS_LABEL, fmtDateTime } from "@/lib/format";

const FIELDS: { key: string; label: string; placeholder?: string; type?: string }[] = [
  { key: "reference", label: "Référence" },
  { key: "quantity", label: "Quantité", type: "number" },
  { key: "format", label: "Format", placeholder: "A4, 100×200mm…" },
  { key: "support", label: "Support / papier", placeholder: "Couché 300g…" },
  { key: "colors", label: "Couleurs", placeholder: "Quadri R°/V°" },
  { key: "finitions", label: "Finitions", placeholder: "Pelliculage, vernis…" },
];

export default function BatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bat, setBat] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("bats").select("*, clients(id,name,email,portal_user_id), projects(id,name)").eq("id", id).maybeSingle();
    setBat(data);
  };
  useEffect(() => { load(); }, [id]);

  const update = async (patch: any) => {
    setBat({ ...bat, ...patch });
    const { error } = await supabase.from("bats").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const uploadFile = async (file: File) => {
    if (!bat) return;
    if (file.type !== "application/pdf") return toast.error("Le fichier doit être un PDF");
    if (file.size > 50 * 1024 * 1024) return toast.error("Fichier trop volumineux (50 Mo max)");
    setUploading(true);
    const path = `${bat.client_id}/${bat.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("bat").upload(path, file, { upsert: false, contentType: "application/pdf" });
    if (error) { setUploading(false); return toast.error(error.message); }
    await update({ file_path: path, file_uploaded_at: new Date().toISOString() });
    setUploading(false);
    toast.success("PDF envoyé");
  };

  const sendForReview = async () => {
    if (!bat?.file_path) return toast.error("Upload d'abord le PDF");
    if (!bat?.clients?.portal_user_id) return toast.error("Le client n'a pas d'accès au portail");
    await update({ status: "en_relecture", sent_at: new Date().toISOString() });
    if (bat?.clients?.email) {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "bat-ready",
          recipientEmail: bat.clients.email,
          idempotencyKey: `bat-ready-${bat.id}-${Date.now()}`,
          templateData: {
            name: bat.clients.name,
            description: bat.title,
            portalUrl: `${window.location.origin}/portail`,
          },
        },
      });
      if (error) toast.warning("BAT envoyé, mais email indisponible");
      else toast.success("BAT envoyé au client (email + portail)");
    } else {
      toast.success("BAT envoyé au portail client (pas d'email renseigné)");
    }
  };

  const remove = async () => {
    if (bat?.file_path) await supabase.storage.from("bat").remove([bat.file_path]);
    await supabase.from("bats").delete().eq("id", id);
    toast.success("BAT supprimé");
    navigate("/bats");
  };

  if (!bat) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/bats")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Retour
      </Button>
      <PageHeader
        title={bat.title}
        description={`${bat.clients?.name ?? ""}${bat.projects?.name ? " · " + bat.projects.name : ""} · ${BAT_STATUS_LABEL[bat.status]}`}
        actions={
          <div className="flex items-center gap-2">
            <input ref={fileInput} type="file" accept="application/pdf" hidden
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> {bat.file_path ? "Remplacer le PDF" : "Uploader le PDF"}
            </Button>
            {bat.file_path && bat.status === "brouillon" && (
              <Button size="sm" onClick={sendForReview}>
                <Send className="h-4 w-4 mr-1" /> Envoyer au client
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce BAT ?</AlertDialogTitle>
                  <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mb-6">
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold">Mentions du BAT</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Titre *</Label>
              <Input value={bat.title ?? ""} onChange={(e) => setBat({ ...bat, title: e.target.value })} onBlur={() => update({ title: bat.title })} maxLength={200} />
            </div>
            {FIELDS.map((f) => (
              <div className="space-y-1.5" key={f.key}>
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={bat[f.key] ?? ""}
                  onChange={(e) => setBat({ ...bat, [f.key]: e.target.value })}
                  onBlur={() => update({ [f.key]: f.type === "number" ? (bat[f.key] ? Number(bat[f.key]) : null) : (bat[f.key] || null) })}
                />
              </div>
            ))}
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Observations</Label>
              <Textarea
                rows={3}
                value={bat.observations ?? ""}
                onChange={(e) => setBat({ ...bat, observations: e.target.value })}
                onBlur={() => update({ observations: bat.observations || null })}
                maxLength={1000}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Cycle de validation</h2>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Créé : </span>{fmtDateTime(bat.created_at)}</div>
            {bat.file_uploaded_at && <div><span className="text-muted-foreground">PDF envoyé : </span>{fmtDateTime(bat.file_uploaded_at)}</div>}
            {bat.sent_at && <div><span className="text-muted-foreground">Envoyé au client : </span>{fmtDateTime(bat.sent_at)}</div>}
            {bat.validated_at && (
              <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Validé {fmtDateTime(bat.validated_at)}
                {bat.signed_by_name && <> par <strong>{bat.signed_by_name}</strong></>}
              </div>
            )}
            {bat.rejected_at && (
              <div className="text-rose-600 dark:text-rose-400 space-y-1">
                <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" /> Rejeté {fmtDateTime(bat.rejected_at)}</div>
                {bat.rejection_reason && <div className="text-foreground bg-rose-500/10 rounded p-2">{bat.rejection_reason}</div>}
              </div>
            )}
          </div>

          <div className="pt-3 border-t space-y-1.5">
            <Label className="text-xs">Forcer le statut</Label>
            <Select value={bat.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BAT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="pt-3 border-t text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground block mb-1">Mentions légales d'un BAT</strong>
            En signant ce Bon à Tirer, le client reconnaît avoir vérifié l'orthographe, la mise en page,
            les visuels, les couleurs (rendu écran à titre indicatif), le format et toutes les indications
            techniques. Sa signature vaut accord pour lancement de l'impression. Toute erreur non signalée
            avant validation ne pourra engager la responsabilité du studio.
          </div>
        </Card>
      </div>

      {bat.file_path ? (
        <BatViewer
          batId={bat.id}
          filePath={bat.file_path}
          canAnnotate={false}
          canResolve={true}
        />
      ) : (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          Aucun PDF uploadé. Clique sur « Uploader le PDF » pour ajouter le bon à tirer.
        </Card>
      )}
    </div>
  );
}