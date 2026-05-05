import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ClientOnboarding from "@/components/ClientOnboarding";

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState<any>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      setClient(c);
    })();
  }, [id]);

  if (!client) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;

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

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <Link to="/clients" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> Clients
      </Link>
      <PageHeader
        title={client.name}
        description={client.company ?? undefined}
        actions={
          client.portal_user_id ? (
            <span className="text-xs inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Portail activé
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={invite} disabled={inviting || !client.email}>
              <Mail className="h-4 w-4 mr-1" /> {inviting ? "Envoi…" : "Inviter au portail"}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Email" value={client.email ?? "—"} />
        <InfoCard label="Téléphone" value={client.phone ?? "—"} />
        <InfoCard label="Adresse" value={client.address ?? "—"} />
      </div>

      <ClientOnboarding clientId={client.id} mode="admin" />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </Card>
  );
}