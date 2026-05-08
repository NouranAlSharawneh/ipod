import type { Frame, NavAction, NavState, View } from "./types";

export const newFrame = (view: View): Frame => ({
  view,
  selected: 0,
  items: [],
  tracks: [],
  loaded: false,
});

export const keyOf = (v: View) => JSON.stringify(v);

export const initialNav: NavState = { stack: [newFrame({ kind: "root" })] };

export function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "push":
      return { stack: [...state.stack, newFrame(action.view)] };

    case "pop":
      if (state.stack.length <= 1) return state;
      return { stack: state.stack.slice(0, -1) };

    case "scroll": {
      const top = state.stack[state.stack.length - 1];
      if (!top) return state;
      const max = top.items.length || 1;
      const next = Math.max(0, Math.min(max - 1, top.selected + action.delta));
      if (next === top.selected) return state;
      return {
        stack: [...state.stack.slice(0, -1), { ...top, selected: next }],
      };
    }

    case "set-data": {
      const top = state.stack[state.stack.length - 1];
      if (!top) return state;
      // Discard writes from a stale fetch whose view is no longer on top.
      if (keyOf(top.view) !== action.viewKey) return state;
      return {
        stack: [
          ...state.stack.slice(0, -1),
          { ...top, items: action.items, tracks: action.tracks, loaded: true },
        ],
      };
    }
  }
}
