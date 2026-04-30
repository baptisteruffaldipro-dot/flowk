import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";
import { Trash2, Send } from "lucide-react";

type AllowedUser = {
  id: string;
  chat_id: number;
  label: string | null;
  created_at: string;
};

export default function TelegramSettings() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_allowed_users")
      .select("id, chat_id, label, created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(chatId.trim(), 10);
    if (isNaN(parsed)) {
      toast({ title: "chat_id invalide", description: "Doit être un nombre.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSubmitting(false); return; }
    const { error } = await supabase.from("telegram_allowed_users").insert({
      chat_id: parsed,
      user_id: u.user.id,
      label: label.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setChatId("");
    setLabel("");
    toast({ title: "Ajouté", description: "Ce compte Telegram peut maintenant créer des tâches." });
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("telegram_allowed_users").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Bot Telegram" description="Crée des tâches en envoyant un message à ton bot Telegram" />

      <Card className="p-5 mb-6 bg-muted/30">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4" /> Comment configurer le bot</h2>
        <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
          <li>Sur Telegram, cherche <span className="font-mono text-foreground">@BotFather</span> et envoie <span className="font-mono text-foreground">/newbot</span>.</li>
          <li>Suis les instructions, récupère le <strong className="text-foreground">token API</strong>. (Si déjà fait dans Lovable Cloud, c'est ok.)</li>
          <li>Cherche <span className="font-mono text-foreground">@userinfobot</span> sur Telegram et envoie n'importe quel message — il te donnera ton <strong className="text-foreground">chat_id</strong> (un nombre).</li>
          <li>Ajoute ce chat_id ci-dessous pour t'autoriser.</li>
          <li>Envoie <span className="font-mono text-foreground">/start</span> à ton bot, puis envoie une description de tâche !</li>
        </ol>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-4">Ajouter un compte autorisé</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label htmlFor="chat_id">chat_id Telegram</Label>
            <Input id="chat_id" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" required />
          </div>
          <div>
            <Label htmlFor="label">Étiquette (optionnel)</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Mon iPhone" />
          </div>
          <Button type="submit" disabled={submitting}>Autoriser</Button>
        </form>
      </Card>

      <Card>
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Comptes autorisés ({users.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-muted-foreground">Chargement…</div>
        ) : users.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Aucun compte autorisé pour le moment.</div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm">{u.chat_id}</div>
                  {u.label && <div className="text-xs text-muted-foreground mt-0.5">{u.label}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}