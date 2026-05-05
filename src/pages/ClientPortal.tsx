import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import ClientOnboarding from "@/components/ClientOnboarding";

export default function ClientPortal() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("clients").select("*").maybeSingle();
      setClient(c);
    })();
  }, []);

  const handleSignOut = async () => { await signOut(); navigate("/auth"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{client?.name ?? "Espace client"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Déconnexion
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {client && <ClientOnboarding clientId={client.id} mode="client" />}
      </main>
    </div>
  );
}