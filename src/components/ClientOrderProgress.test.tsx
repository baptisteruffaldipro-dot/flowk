import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ClientOrderProgress, { ClientOrderHistory } from "./ClientOrderProgress";

describe("Client order progress", () => {
  it("marks printing as current and shows only the recorded delivery estimate", () => {
    render(<ClientOrderProgress step={3} impression events={[]} deadline="2026-10-22" detail="La commande est en production." />);
    expect(screen.getByRole("list", { name: "Avancement de la commande" }).querySelector('[aria-current="step"]')).toHaveTextContent("Impression");
    expect(screen.getByText("En cours · Étape 4 sur 4")).toBeVisible();
    expect(screen.getByText("jeudi 22 octobre")).toBeVisible();
    expect(screen.queryByText("Commande livrée")).not.toBeInTheDocument();
  });
  it("does not imply printing has started when the BAT is approved", () => {
    render(<ClientOrderProgress step={2} impression events={[]} detail="BAT validé — en attente du lancement de l’impression." />);
    expect(screen.getByRole("list", { name: "Avancement de la commande" }).querySelector('[aria-current="step"]')).toHaveTextContent("Récapitulatif & règlement");
    expect(screen.queryByText("Livraison prévue le")).not.toBeInTheDocument();
  });
  it("shows delivered completion without an active or upcoming production stage", () => {
    render(<ClientOrderProgress step={3} completed impression events={[{ label: "Commande livrée", at: "2026-10-22T12:00:00Z" }]} />);
    expect(screen.getByText("Terminé · Étape 4 sur 4")).toBeVisible();
    expect(screen.getByRole("list", { name: "Avancement de la commande" }).querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.queryByText("En ce moment et à venir")).not.toBeInTheDocument();
  });
  it("groups recorded events and hides invalid or missing planned dates", () => {
    render(<ClientOrderHistory step={0} deadline="not-a-date" events={[{ label: "Commande reçue", at: "2026-10-15T09:00:00Z" }, { label: "BAT validé", at: "2026-10-15T12:00:00Z", detail: "Signé par Client test" }]} />);
    expect(screen.getByText("Aujourd'hui")).toBeVisible();
    expect(screen.getByText("2 étapes")).toBeVisible();
    expect(screen.getByText("Signé par Client test")).toBeVisible();
    expect(screen.queryByText("Livraison prévue")).not.toBeInTheDocument();
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });
  it("uses download instead of printing for digital work", () => {
    render(<ClientOrderProgress step={3} completed events={[]} />);
    expect(screen.getByText("Téléchargement du fichier")).toBeVisible();
    expect(screen.getByText("Fichiers disponibles")).toBeVisible();
    expect(screen.queryByText("Impression")).not.toBeInTheDocument();
  });
});