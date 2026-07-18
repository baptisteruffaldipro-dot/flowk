import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PaymentSettings() {
  const [row, setRow] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payment_settings" as any).select("*").eq("id", 1).maybeSingle();
      setRow(data ?? { id: 1 });
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("payment_settings" as any).upsert({
      id: 1,
      iban: row.iban ?? null,
      bic: row.bic ?? null,
      account_holder: row.account_holder ?? null,
      bank_name: row.bank_name ?? null,
      transfer_note: row.transfer_note ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Paramètres enregistrés");
  };

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Paramètres de paiement" description="Coordonnées bancaires affichées sur les portails clients" />
      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Titulaire du compte" value={row.account_holder} onChange={(v) => setRow({ ...row, account_holder: v })} />
          <Field label="Banque" value={row.bank_name} onChange={(v) => setRow({ ...row, bank_name: v })} />
          <Field label="IBAN" value={row.iban} onChange={(v) => setRow({ ...row, iban: v })} />
          <Field label="BIC / SWIFT" value={row.bic} onChange={(v) => setRow({ ...row, bic: v })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Note pour le virement (référence à mentionner, délai…)</Label>
          <Textarea rows={3} value={row.transfer_note ?? ""} onChange={(e) => setRow({ ...row, transfer_note: e.target.value })} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string | null; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}