import { useCallback, useState } from "react";
import { api, type Track } from "../state/api";

export type Queue = {
  tracks: Track[];
  index: number;
  playlistId?: string;
};

export function useQueue() {
  const [queue, setQueue] = useState<Queue | null>(null);

  const start = useCallback(
    async (tracks: Track[], index: number, playlistId?: string) => {
      const t = tracks[index];
      if (!t) return;
      const body: { trackId: string; playlistId?: string } = { trackId: t.id };
      if (playlistId) body.playlistId = playlistId;
      await api.play(body).catch(() => {});
      setQueue({ tracks, index, playlistId });
    },
    [],
  );

  const step = useCallback(
    async (delta: number) => {
      if (!queue || queue.tracks.length === 0) {
        if (delta > 0) await api.next().catch(() => {});
        else await api.previous().catch(() => {});
        return;
      }
      const len = queue.tracks.length;
      const nextIdx = (queue.index + delta + len) % len;
      const t = queue.tracks[nextIdx];
      const body: { trackId: string; playlistId?: string } = { trackId: t.id };
      if (queue.playlistId) body.playlistId = queue.playlistId;
      await api.play(body).catch(() => {});
      setQueue({ ...queue, index: nextIdx });
    },
    [queue],
  );

  return { queue, start, step };
}
