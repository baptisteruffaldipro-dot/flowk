import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PrintDeliveryFields from "./PrintDeliveryFields";

describe("Admin print delivery details", () => {
  it("passes the entered delivery location to the order form", () => {
    const onLocationChange = vi.fn();
    render(<PrintDeliveryFields date="" location="" onDateChange={vi.fn()} onLocationChange={onLocationChange} />);
    fireEvent.change(screen.getByLabelText("Lieu de livraison"), { target: { value: "Atelier de test\n12 rue des Essais, Lyon" } });
    expect(onLocationChange).toHaveBeenCalledWith("Atelier de test\n12 rue des Essais, Lyon");
  });
  it("allows the administrator to remove a recorded delivery date", () => {
    const onDateChange = vi.fn();
    render(<PrintDeliveryFields date="2026-10-30" location="" onDateChange={onDateChange} onLocationChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Effacer la date de livraison" }));
    expect(onDateChange).toHaveBeenCalledWith("");
  });
});