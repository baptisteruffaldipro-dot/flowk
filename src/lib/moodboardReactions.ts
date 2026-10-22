export type MoodboardReaction = "like" | "dislike";
export type MoodboardReactions = Record<string, MoodboardReaction>;

/** Clicking the active reaction again clears it; otherwise it replaces the previous one. */
export function nextReaction(current: MoodboardReaction | undefined, clicked: MoodboardReaction): MoodboardReaction | null {
  return current === clicked ? null : clicked;
}

export function applyReaction(sel: MoodboardReactions, url: string, reaction: MoodboardReaction | null): MoodboardReactions {
  const next = { ...sel };
  if (reaction) next[url] = reaction;
  else delete next[url];
  return next;
}

export function countReactions(sel: MoodboardReactions, urls: string[]) {
  let likes = 0, dislikes = 0;
  for (const u of urls) {
    if (sel[u] === "like") likes++;
    else if (sel[u] === "dislike") dislikes++;
  }
  return { likes, dislikes };
}
