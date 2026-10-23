import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PresentationExchange from "./PresentationExchange";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) query[method] = () => query;
    query.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    query.insert = mocks.insert;
    return query;
  },
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Presentation exchanges", () => {
  it.each(["brand_strategy", "logo_presentation"] as const)("sends client feedback through the scoped %s token", async kind => {
    mocks.rpc.mockResolvedValue({ data: { messages: [], reactions: {} }, error: null });
    render(<PresentationExchange kind={kind} presentationId="presentation" token="private-link" />);
    fireEvent.click(screen.getByRole("button", { name: "Échanges" }));
    const input = await screen.findByRole("textbox", { name: "Votre message" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled());
    fireEvent.change(input, { target: { value: "Mon retour client" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Envoyer" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("presentation_add_message_by_token", { _kind: kind, _token: "private-link", _body: "Mon retour client" }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("stores a studio reply on the selected strategy only", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    render(<PresentationExchange kind="brand_strategy" presentationId="strategy-id" />);
    await screen.findByText("Aucun échange pour le moment.");
    fireEvent.change(screen.getByRole("textbox", { name: "Votre message" }), { target: { value: "Voici ma réponse" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ brand_strategy_id: "strategy-id", logo_presentation_id: null, author: "studio", body: "Voici ma réponse" }));
  });
});