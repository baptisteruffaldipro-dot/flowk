import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClientBatApproval from "./ClientBatApproval";

describe("Client BAT approval", () => {
  it("requires all checks and a named signer before approving", async () => {
    const approve = vi.fn().mockResolvedValue(true);
    render(<ClientBatApproval busy={false} onApprove={approve} onCorrection={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Je valide le BAT" });
    expect(button).toBeDisabled();
    screen.getAllByRole("checkbox").forEach(check => fireEvent.click(check));
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nom et prénom (signature)"), { target: { value: " Test Signataire " } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(approve).toHaveBeenCalledWith("Test Signataire"));
  });

  it("keeps corrections after an error and clears only on success", async () => {
    const correction = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ClientBatApproval busy={false} onApprove={vi.fn()} onCorrection={correction} />);
    fireEvent.click(screen.getByRole("button", { name: "Demander une correction" }));
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Votre demande de correction"), { target: { value: "Corriger la date" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(correction).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Votre demande de correction")).toHaveValue("Corriger la date");
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await screen.findByRole("button", { name: "Demander une correction" });
  });

  it("shows the certificate but no locked download after validation", () => {
    const certificate = vi.fn();
    render(<ClientBatApproval busy={false} approved signedBy="Test Signataire" signedAt="2026-10-15T12:00:00Z" onApprove={vi.fn()} onCorrection={vi.fn()} onCertificate={certificate} />);
    expect(screen.getByText("BAT validé")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Télécharger le BAT" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Certificat de validation" }));
    expect(certificate).toHaveBeenCalledOnce();
  });
});