/** Libellé affiché pour un BAT : « BAT 1 : Flyer », ou « BAT 1 » sans nom. */
export function batLabel(index: number, label?: string | null): string {
  const clean = (label ?? "").trim();
  return clean ? `BAT ${index + 1} : ${clean}` : `BAT ${index + 1}`;
}
