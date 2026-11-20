"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resizeImage } from "@/lib/image-client";
import { IMAGE_TYPES, validateImageFile } from "@/lib/schedule-import";
import type { MemberProfile } from "@/lib/types";
import { MemberAvatar } from "@/components/shared/bits";

const PHOTO_EDGE = 256;
const PHOTO_MAX_BYTES = 100 * 1024;

/**
 * Profile photo (V3 §9.1): JPEG/PNG/WebP up to 8 MB, cropped and resized in the browser to
 * 256×256 (≈100 KB) before it's stored. Initials avatar when there's none.
 */
export function PhotoField({ profile, onChange }: { profile: MemberProfile; onChange: (p: MemberProfile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const errId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, { maxEdge: PHOTO_EDGE, square: true, maxBytes: PHOTO_MAX_BYTES });
      onChange({ ...profile, photo: { dataUrl, updatedAt: new Date().toISOString() } });
    } catch {
      setError("That image couldn't be read. Try another file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <MemberAvatar member={profile} size="xl" className="ring-line" />
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={() => input.current?.click()} aria-describedby={error ? errId : undefined}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {profile.photo ? "Change photo" : "Add a photo"}
          </Button>
          {profile.photo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => {
                setError(null);
                onChange({ ...profile, photo: null });
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground">Optional. JPEG, PNG or WebP, up to 8 MB. Stays in this browser.</p>
        {error && (
          <p id={errId} role="alert" className="text-[12.5px] font-medium text-blocker">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a profile photo"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
