import { describe, expect, it } from "vitest";
import type { Comment } from "../src/lib/api-types.js";
import { buildCommentTree, countComments } from "../src/lib/commentTree.js";

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    author: { identityId: "author-id", name: "Author" },
    text: "text",
    createdAt: 0,
    parent: null,
    record: {},
    ...overrides,
  };
}

describe("buildCommentTree", () => {
  it("nests replies under their parent, several levels deep", () => {
    const comments = [
      makeComment({ id: "a", createdAt: 1, parent: null }),
      makeComment({ id: "b", createdAt: 2, parent: "a" }),
      makeComment({ id: "c", createdAt: 3, parent: "b" }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.comment.id).toBe("a");
    expect(tree[0]?.children[0]?.comment.id).toBe("b");
    expect(tree[0]?.children[0]?.children[0]?.comment.id).toBe("c");
  });

  it("sorts siblings oldest first", () => {
    const comments = [
      makeComment({ id: "later", createdAt: 5, parent: null }),
      makeComment({ id: "earlier", createdAt: 1, parent: null }),
    ];

    const tree = buildCommentTree(comments);

    expect(tree.map((n) => n.comment.id)).toEqual(["earlier", "later"]);
  });

  it("promotes a reply whose parent isn't in the list to a root instead of dropping it", () => {
    const comments = [makeComment({ id: "orphan", parent: "some-deindexed-parent" })];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.comment.id).toBe("orphan");
  });

  it("returns no roots for an empty list", () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});

describe("countComments", () => {
  it("counts every node across the whole tree, not just roots", () => {
    const comments = [
      makeComment({ id: "a", parent: null }),
      makeComment({ id: "b", parent: "a" }),
      makeComment({ id: "c", parent: "a" }),
      makeComment({ id: "d", parent: "c" }),
    ];

    expect(countComments(buildCommentTree(comments))).toBe(4);
  });

  it("is zero for an empty tree", () => {
    expect(countComments([])).toBe(0);
  });
});
