import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postReaction } from "../api.js";
import { useMe } from "../hooks/useMe.js";

export interface ReactionBarProps {
  videoId: string;
  reactions: Record<string, number>;
}

/** Fixed reaction set — API.md's reaction is a free-form string, but a
 *  fixed palette keeps the bar uniform across gateways per spec 009 §7. */
const REACTIONS = ["like", "love", "laugh", "insightful"] as const;
const REACTION_EMOJI: Record<(typeof REACTIONS)[number], string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  insightful: "💡",
};

export function ReactionBar({ videoId, reactions }: ReactionBarProps): JSX.Element {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (reaction: string) => postReaction(videoId, reaction),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["video", videoId] }),
  });

  return (
    <div role="group" aria-label="Reactions on this gateway" className="flex flex-wrap gap-2">
      {REACTIONS.map((reaction) => (
        <button
          key={reaction}
          type="button"
          disabled={!me || mutation.isPending}
          onClick={() => mutation.mutate(reaction)}
          title={me ? `React with ${reaction}` : "Sign in to react"}
          className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          <span aria-hidden="true">{REACTION_EMOJI[reaction]}</span>
          <span>{reactions[reaction] ?? 0}</span>
          <span className="sr-only"> {reaction} reactions on this gateway</span>
        </button>
      ))}
    </div>
  );
}
