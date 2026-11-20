"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, User, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actions, lobbyHeadcount, selectActiveLobby, useAppState, useHydrated } from "@/lib/store";
import { useCreateLobby } from "@/components/lobby/create-lobby";
import { cn } from "@/lib/utils";

/** Active-lobby pill (V3 §7.1): your lobbies, Solo search, + Create a Lobby. */
export function LobbySwitcher({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const state = useAppState();
  const router = useRouter();
  const { openCreateLobby } = useCreateLobby();
  const active = hydrated ? selectActiveLobby(state) : null;
  const label = !hydrated ? "…" : active ? active.name : "Solo search";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 max-w-[13rem] items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
          className,
        )}
        aria-label={`Active group: ${label}. Switch group`}
      >
        {active ? <Users className="size-3.5 text-teal" aria-hidden /> : <User className="size-3.5 text-muted-foreground" aria-hidden />}
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Search as</DropdownMenuLabel>
          {state.lobbies.map((l) => (
            <DropdownMenuItem key={l.id} className="justify-between gap-3 py-2" onClick={() => actions.setActiveLobby(l.id)}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-ink">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  {lobbyHeadcount(l)} of {l.targetSize} · {l.targetSize}-bedroom homes
                </span>
              </span>
              {active?.id === l.id && <Check className="size-4 shrink-0 text-teal" aria-hidden />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem className="justify-between gap-3 py-2" onClick={() => actions.setActiveLobby(null)}>
            <span className="flex flex-col">
              <span className="font-medium text-ink">Solo search</span>
              <span className="text-xs text-muted-foreground">Any size, priced per room</span>
            </span>
            {hydrated && !active && <Check className="size-4 text-teal" aria-hidden />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 py-2 font-medium text-teal" onClick={() => openCreateLobby()}>
          <Plus className="size-4" aria-hidden /> Create a Lobby
        </DropdownMenuItem>
        {active && (
          <DropdownMenuItem className="py-2" onClick={() => router.push(`/lobbies/${active.id}`)}>
            View {active.name}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
