// Une validation ne compte que pour la version du fichier envoyée avant elle.
// Si l'atelier renvoie un fichier portant le même nom, l'ancienne validation est ignorée.

type FileLike = { name?: string; url?: string; preview_url?: string; uploaded_at?: string };
type ReviewLike = { file?: string; status?: string; at?: string };

export const fileUploadedAt = (file: FileLike): number | null => {
  if (file.uploaded_at) {
    const t = Date.parse(file.uploaded_at);
    if (!Number.isNaN(t)) return t;
  }
  const src = file.preview_url ?? file.url ?? "";
  const m = src.match(/\/(\d{13})-[^/?]*(\?|$)/);
  return m ? Number(m[1]) : null;
};

export const reviewForFile = <R extends ReviewLike>(reviews: R[], file: FileLike): R | undefined => {
  const uploaded = fileUploadedAt(file);
  return reviews.find((r) => {
    if (r.file !== file.name) return false;
    if (uploaded == null || !r.at) return true;
    return Date.parse(r.at) >= uploaded;
  });
};

export const isFileApproved = (reviews: ReviewLike[], file: FileLike) =>
  reviewForFile(reviews, file)?.status === "approved";
