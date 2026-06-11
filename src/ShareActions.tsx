/**
 * Bolado — ShareActions component (Task 1.6)
 *
 * Lean share implementation for the VerdictScreen:
 *   - Primary "Compartilhar 📋": navigator.share (text-only) when available,
 *     clipboard fallback.
 *   - Secondary "Copiar": always writes to clipboard.
 *   - AbortError is silently swallowed (user cancelled the share sheet).
 *   - Pressed-state feedback "Copiado!" for 2s with timer cleanup.
 *   - Fires `daily_share_text` analytics event with { formatVersion }.
 */

import { useCallback, useRef, useState } from "react";
import { trackFirstPartyEvent } from "./engine/analytics";
import { SHARE_FORMAT_VERSION } from "./shareDaily";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShareActionsProps {
  shareText: string;
  onReplayReveal: () => void;
}

// ---------------------------------------------------------------------------
// ShareActions
// ---------------------------------------------------------------------------

export function ShareActions({ shareText, onReplayReveal }: ShareActionsProps) {
  const [feedback, setFeedback] = useState<"none" | "shared" | "copied">("none");
  const feedbackTimer = useRef<number | null>(null);

  function showFeedback(kind: "shared" | "copied") {
    setFeedback(kind);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback("none"), 2000);
  }

  async function writeToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(shareText);
  }

  const handleShare = useCallback(async () => {
    // Try native share (text-only payload)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: shareText });
        // Fire analytics on successful share
        trackFirstPartyEvent("daily_share_text", { formatVersion: SHARE_FORMAT_VERSION });
        showFeedback("shared");
        return;
      } catch (error) {
        // AbortError = user cancelled — ignore
        if ((error as DOMException)?.name === "AbortError") return;
        // Other error → fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await writeToClipboard();
      trackFirstPartyEvent("daily_share_text", { formatVersion: SHARE_FORMAT_VERSION });
      showFeedback("copied");
    } catch {
      // Clipboard unavailable — nothing useful to surface
    }
  }, [shareText]);

  const handleCopy = useCallback(async () => {
    try {
      await writeToClipboard();
      trackFirstPartyEvent("daily_share_text", { formatVersion: SHARE_FORMAT_VERSION });
      showFeedback("copied");
    } catch {
      // Clipboard unavailable — degrade silently
    }
  }, [shareText]);

  const shareLabel = feedback === "shared" || feedback === "copied" ? "Copiado! ✓" : "Compartilhar 📋";
  const copyLabel = feedback === "copied" ? "Copiado! ✓" : "Copiar";

  return (
    <div className="bolado-verdict-actions bolado-verdict-item--enter">
      <button
        type="button"
        className="bolado-verdict-share-btn"
        onClick={() => void handleShare()}
        aria-label="Compartilhar resultado"
      >
        {shareLabel}
      </button>
      <button
        type="button"
        className="bolado-verdict-copy-btn"
        onClick={() => void handleCopy()}
        aria-label="Copiar resultado para a área de transferência"
      >
        {copyLabel}
      </button>
      <button
        type="button"
        className="bolado-verdict-replay-btn"
        onClick={onReplayReveal}
        aria-label="Rever a partida"
      >
        ⏮ Rever partida
      </button>
    </div>
  );
}
