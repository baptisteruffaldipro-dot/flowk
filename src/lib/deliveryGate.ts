import { supabase } from "@/integrations/supabase/client";

export type DeliveryEntityType = "task" | "print_order" | "logo_presentation";
export type DeliveryUnlockRule = "acompte" | "total" | "libre";

export type DeliveryGateRow = {
  id: string;
  delivery_unlock_rule: DeliveryUnlockRule;
  delivery_override: boolean;
  delivery_override_at?: string | null;
  invoice_url?: string | null;
  // optional, only for print_order
  bat_validated_at?: string | null;
};

export type DeliveryStatus =
  | { state: "available"; reason: string }
  | { state: "blocked_bat"; reason: string }
  | { state: "blocked_payment"; reason: string }
  | { state: "no_invoice"; reason: string };

export type InstallmentRow = {
  amount: number | string;
  paid_amount: number | string;
};

export function computeDeliveryStatus(
  entityType: DeliveryEntityType,
  row: DeliveryGateRow,
  installments: InstallmentRow[],
): DeliveryStatus {
  if (row.delivery_override) {
    return { state: "available", reason: "Téléchargement autorisé manuellement" };
  }
  if (entityType === "print_order" && !row.bat_validated_at) {
    return { state: "blocked_bat", reason: "BAT à valider avant livraison" };
  }
  if (row.delivery_unlock_rule === "libre") {
    return { state: "available", reason: "Téléchargement libre" };
  }
  if (installments.length === 0) {
    return { state: "no_invoice", reason: "Facture / échéances à créer" };
  }
  const totalDue = installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = installments.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const anyInstallmentPaid = installments.some(
    (i) => Number(i.amount || 0) > 0 && Number(i.paid_amount || 0) >= Number(i.amount || 0),
  );
  if (row.delivery_unlock_rule === "acompte") {
    return anyInstallmentPaid
      ? { state: "available", reason: "Acompte encaissé" }
      : { state: "blocked_payment", reason: "Acompte à régler" };
  }
  // total
  return totalDue > 0 && totalPaid >= totalDue
    ? { state: "available", reason: "Solde encaissé" }
    : { state: "blocked_payment", reason: "Solde restant à régler" };
}

export const UNLOCK_RULE_LABEL: Record<DeliveryUnlockRule, string> = {
  acompte: "Acompte payé",
  total: "Solde total payé",
  libre: "Libre (aucun verrou)",
};

/** Demande au backend si le client peut télécharger, fait foi côté serveur. */
export async function checkCanDownload(entityType: DeliveryEntityType, entityId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_download" as any, {
    _entity_type: entityType,
    _entity_id: entityId,
  });
  if (error) return false;
  return Boolean(data);
}

/** Charge les échéances liées à une tâche ou commande d'impression. */
export async function loadEntityInstallments(
  entityType: DeliveryEntityType,
  entityId: string,
): Promise<InstallmentRow[]> {
  if (entityType === "logo_presentation") return [];
  const filterCol = entityType === "task" ? "task_id" : "print_order_id";
  const { data: invs } = await supabase.from("invoices").select("id").eq(filterCol, entityId);
  const ids = (invs ?? []).map((i: any) => i.id);
  if (ids.length === 0) return [];
  const { data: ii } = await supabase
    .from("invoice_installments")
    .select("amount,paid_amount")
    .in("invoice_id", ids);
  return (ii ?? []) as InstallmentRow[];
}