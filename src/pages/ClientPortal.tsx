import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

export default function ClientPortal() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Espace client</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-1" /> Déconnexion</Button>
        </div>
        <Card className="p-12 text-center">
          <h2 className="text-lg font-medium mb-2">Bientôt disponible</h2>
          <p className="text-sm text-muted-foreground">
            Tes projets, briefs et BAT à valider apparaîtront ici dès que ton graphiste te les partagera.
          </p>
        </Card>
      </div>
    </div>
  );
}