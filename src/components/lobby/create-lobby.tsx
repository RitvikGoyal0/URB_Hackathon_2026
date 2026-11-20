"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { universities } from "@/lib/data";
import { actions, MAX_LOBBY_SIZE, MIN_LOBBY_SIZE } from "@/lib/store";

type OnCreated = (lobbyId: string) => void;
interface Ctx {
  /** Open Create Lobby. `onCreated` runs after the lobby exists; without it we go to the lobby page. */
  openCreateLobby: (onCreated?: OnCreated) => void;
}
const CreateLobbyContext = createContext<Ctx | null>(null);

export function useCreateLobby(): Ctx {
  const ctx = useContext(CreateLobbyContext);
  if (!ctx) throw new Error("useCreateLobby must be used inside <CreateLobbyProvider>");
  return ctx;
}

export function CreateLobbyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const after = useRef<OnCreated | undefined>(undefined);
  const openCreateLobby = useCallback((onCreated?: OnCreated) => {
    after.current = onCreated;
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openCreateLobby }), [openCreateLobby]);
  return (
    <CreateLobbyContext value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create a lobby</DialogTitle>
            <DialogDescription>Your housing group. Invite friends, then find homes that fit everyone.</DialogDescription>
          </DialogHeader>
          <CreateLobbyForm
            key={formKey}
            onDone={(id) => {
              setOpen(false);
              if (after.current) after.current(id);
              else router.push(`/lobbies/${id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </CreateLobbyContext>
  );
}

function CreateLobbyForm({ onDone }: { onDone: OnCreated }) {
  const [name, setName] = useState("");
  const [size, setSize] = useState(4);
  const [moveIn, setMoveIn] = useState("");
  const umich = universities.find((u) => u.status === "active");
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const id = actions.createLobby({ name: name || "Fall 2027 Roommates", targetSize: size, moveIn });
        toast.success(`Lobby "${name.trim() || "Fall 2027 Roommates"}" created`);
        onDone(id);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="lobby-name">Group name</Label>
        <Input id="lobby-name" autoFocus placeholder="Fall 2027 Roommates" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lobby-uni">University</Label>
        <select
          id="lobby-uni"
          className="h-10 rounded-lg border border-input bg-white px-3 text-[14px]"
          defaultValue={umich?.id}
          onChange={(e) => {
            if (e.target.value !== umich?.id) {
              toast.message("Only Michigan is live right now. Other schools are coming soon.");
              e.target.value = umich?.id ?? "";
            }
          }}
        >
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.status === "coming_soon" ? " (coming soon)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium" id="lobby-size-label">
          Group size
        </span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="lobby-size-label">
          <Button type="button" variant="outline" size="icon" aria-label="Fewer people" disabled={size <= MIN_LOBBY_SIZE} onClick={() => setSize((s) => s - 1)}>
            <Minus className="size-4" />
          </Button>
          <span className="w-24 text-center font-display text-lg font-semibold tabular-nums" aria-live="polite">
            {size} people
          </span>
          <Button type="button" variant="outline" size="icon" aria-label="More people" disabled={size >= MAX_LOBBY_SIZE} onClick={() => setSize((s) => s + 1)}>
            <Plus className="size-4" />
          </Button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">We&apos;ll show homes with exactly {size} bedrooms.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lobby-movein">
          Move-in <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="lobby-movein" placeholder="Fall 2027" maxLength={30} value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
      </div>
      <Button type="submit" className="mt-1 h-11 rounded-full text-[15px]">
        Create Lobby
      </Button>
    </form>
  );
}

