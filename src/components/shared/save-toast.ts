"use client";

import { toast } from "sonner";
import { actions } from "@/lib/store";

/** Remove a saved home (and your vote on it), with an Undo toast that restores both. */
export function unsaveWithUndo(listingId: string, name: string) {
  const removed = actions.unsave(listingId);
  if (!removed) return;
  toast(removed.vote ? `Removed ${name} and cleared your vote` : `Removed ${name} from saved homes`, {
    action: { label: "Undo", onClick: () => actions.restore(removed) },
  });
}

/** The bookmark button: save, or unsave with Undo. */
export function toggleSaved(listingId: string, name: string) {
  if (actions.save(listingId)) toast(`Saved ${name}`);
  else unsaveWithUndo(listingId, name);
}
