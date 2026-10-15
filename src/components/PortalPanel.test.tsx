import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PortalPanel from "./PortalPanel";

vi.mock("@/components/PortalAnnotationsAdmin", () => ({ default: () => null }));
vi.mock("@/lib/publicUrl", () => ({ getPublicAppUrl: () => "https://example.test" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const data = table === "client_portals" ? {
        id: "portal", share_token: "test", status: "draft", is_published: false,
        delivery_unlock_rule: "total", admin_confirmed_paid_at: null,
        payment_methods: ["link", "transfer"], payment_terms: "full", amount_due_ttc: 0,
      } : table === "tasks" ? { deliverable_files: [{ name: "Visuel.pdf", url: "https://example.test/file.pdf" }], billing_type: "forfait", flat_amount: 0 } : [];
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit", "in", "update", "insert"]) query[method] = () => query;
      query.maybeSingle = () => Promise.resolve({ data });
      query.then = (resolve: (result: { data: unknown }) => unknown) => Promise.resolve({ data }).then(resolve);
      return query;
    },
  },
}));

describe("Task portal workspace", () => {
  it("keeps the four sections and preserves an unsent reply across tabs", async () => {
    render(<PortalPanel entityType="task" entityId="task" taskWorkspace={{ work: <p>Brief de la tâche</p>, billing: <p>Chiffrage de la tâche</p> }} />);
    await screen.findByRole("tab", { name: "Travail" });
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByText("Brief de la tâche")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Échanges" }), { button: 0, ctrlKey: false });
    const reply = screen.getByPlaceholderText("Répondre au client…");
    await waitFor(() => expect(reply).toBeVisible());
    fireEvent.change(reply, { target: { value: "Correction en cours" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Travail" }), { button: 0, ctrlKey: false });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Échanges" }), { button: 0, ctrlKey: false });
    expect(reply).toHaveValue("Correction en cours");
    expect(screen.getByRole("link", { name: "Ouvrir" })).toHaveAttribute("href", "https://example.test/p/c/test");
  });
});