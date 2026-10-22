import { describe, it, expect } from "vitest";
import { nextReaction, applyReaction, countReactions } from "./moodboardReactions";

describe("moodboard reactions", () => {
  it("clicking the same reaction clears it", () => {
    expect(nextReaction("like", "like")).toBeNull();
  });
  it("switching from like to dislike replaces it", () => {
    expect(nextReaction("like", "dislike")).toBe("dislike");
  });
  it("counts likes and dislikes only for the given images", () => {
    const sel = applyReaction(applyReaction({ c: "like" }, "a", "like"), "b", "dislike");
    expect(countReactions(sel, ["a", "b"])).toEqual({ likes: 1, dislikes: 1 });
    expect(applyReaction(sel, "a", null)).toEqual({ b: "dislike", c: "like" });
  });
});
