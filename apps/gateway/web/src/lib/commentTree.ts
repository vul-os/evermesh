import type { Comment } from "./api-types.js";

/**
 * Threading logic for comments, factored out from `CommentThread.tsx` as
 * a pure function so it's unit-testable without rendering React. The
 * API (API.md) returns a flat list with a `parent` pointer; we build
 * the tree client-side. A comment whose `parent` doesn't resolve to
 * another item in the list (deleted parent, de-indexed by policy, or a
 * pagination boundary) is promoted to a root rather than dropped —
 * losing a whole subtree silently would be worse than showing it
 * slightly out of place.
 */
export interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const comment of comments) byId.set(comment.id, { comment, children: [] });

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (!node) continue;
    const parent = comment.parent ? byId.get(comment.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  sortByTimeRecursive(roots);
  return roots;
}

function sortByTimeRecursive(nodes: CommentNode[]): void {
  nodes.sort((a, b) => a.comment.createdAt - b.comment.createdAt);
  for (const node of nodes) sortByTimeRecursive(node.children);
}

/** Total comment count in a tree (for "N comments on this gateway"). */
export function countComments(nodes: CommentNode[]): number {
  let total = 0;
  for (const node of nodes) total += 1 + countComments(node.children);
  return total;
}
