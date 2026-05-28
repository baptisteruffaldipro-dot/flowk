import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Share2, Calendar as CalendarIcon, FileText } from "lucide-react";

type ClientRow = { id: string; name: string; company: string | null };
type Stat = { posts_count: number; upcoming_count: number; has_strategy: boolean };

export default function SocialMedia() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from("clients").select("id,name,company").order("name");
      setClients((cs ?? []) as ClientRow[]);
      const [{ data: posts }, { data: strategies }] = await Promise.all([
        supabase.from("social_posts").select("client_id, scheduled_at, status"),
        supabase.from("social_strategies").select("client_id"),
      ]);
      const map: Record<string, Stat> = {};
      const now = Date.now();
      (posts ?? []).forEach((p: any) => {
        const s = (map[p.client_id] ||= { posts_count: 0, upcoming_count: 0, has_strategy: false });
        s.posts_count++;
        if (p.scheduled_at && new Date(p.scheduled_at).getTime() >= now && p.status !== "publie" && p.status !== "annule") {
          s.upcoming_count++;
        }
      });
      (strategies ?? []).forEach((s: any) => {
        (map[s.client_id] ||= { posts_count: 0, upcoming_count: 0, has_strategy: false }).has_strategy = true;
      });
      setStats(map);
    })();
  }, []);

  const filtered = clients.filter((c) => {
    const t = (c.name + " " + (c.company ?? "")).toLowerCase();
    return t.includes(q.toLowerCase());
  });

  const withActivity = filtered.filter((c) => stats[c.id]);
  const others = filtered.filter((c) => !stats[c.id]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Réseaux sociaux"
        description="Calendrier éditorial, stratégie et publications par client"
      />
      <Input
        placeholder="Rechercher un client…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {withActivity.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Clients actifs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {withActivity.map((c) => (
              <ClientCard key={c.id} client={c} stat={stats[c.id]} />
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tous les clients</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {others.map((c) => (
          <ClientCard key={c.id} client={c} stat={stats[c.id]} />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client, stat }: { client: ClientRow; stat?: Stat }) {
  return (
    <Link to={`/social/${client.id}`}>
      <Card className="hover:border-primary/40 transition-colors h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
              <Share2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{client.name}</div>
              {client.company && <div className="text-xs text-muted-foreground truncate">{client.company}</div>}
              {stat ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="secondary" className="gap-1"><CalendarIcon className="h-3 w-3" />{stat.upcoming_count} à venir</Badge>
                  <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />{stat.posts_count} posts</Badge>
                  {stat.has_strategy && <Badge variant="outline">Stratégie</Badge>}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-2">Aucune activité — cliquer pour commencer</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}