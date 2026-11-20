"use client";

import { Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Lobby } from "@/lib/types";

const BASE = "https://hack-the-lease-seven.vercel.app/join";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "lobby";
}

/** FNV-1a → base36, repeated with different seeds: a stable token that only depends on the lobby id. */
function token(id: string, len = 16) {
  let out = "";
  for (let seed = 0; out.length < len; seed++) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
    out += (h >>> 0).toString(36);
  }
  return out.slice(0, len);
}

/** A cosmetic, stable invite URL for this lobby (there is no /join route). */
export function inviteUrl(lobby: Pick<Lobby, "id" | "name">) {
  return `${BASE}/${slug(lobby.name)}-${lobby.id.replace(/^lobby_/, "")}?ref=${token(lobby.id)}&invite=${token(lobby.id + ":i", 12)}`;
}

export function InviteLink({ lobby }: { lobby: Pick<Lobby, "id" | "name"> }) {
  const url = inviteUrl(lobby);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Select the link instead.");
    }
  }
  return (
    <div className="mt-3 min-w-0 rounded-2xl border border-line bg-paper p-3">
      <label htmlFor="invite-link" className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        <Link2 className="size-3.5" aria-hidden /> Send friends a link to join
      </label>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <input
          id="invite-link"
          readOnly
          size={1}
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 text-[13px] text-charcoal outline-none focus-visible:ring-3 focus-visible:ring-teal/40"
        />
        <Button size="sm" className="h-9 shrink-0 rounded-full px-3.5" onClick={copy}>
          <Copy aria-hidden /> Copy link
        </Button>
      </div>
    </div>
  );
}
