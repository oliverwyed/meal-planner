// Parse step text into segments — plain text or clickable timer
// e.g. "cook for 8 mins" → [{ text: "cook for " }, { text: "8 mins", seconds: 480 }]
export function parseTimerParts(text: string): { text: string; seconds?: number }[] {
  // Match patterns like "8 mins", "30 seconds", "1 hour 20 minutes", "45 sec", "2 hrs"
  const timerPattern = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h(?!\w)|minutes?|mins?|m(?!\w)|seconds?|secs?|s(?!\w))(?:\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m(?!\w)|seconds?|secs?|s(?!\w)))?/gi;

  const parts: { text: string; seconds?: number }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = timerPattern.exec(text)) !== null) {
    // Push plain text before the match
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }

    // Calculate seconds
    const val1 = parseFloat(match[1]);
    const unit1 = match[2].toLowerCase();
    let seconds = 0;

    if (unit1.startsWith('h')) {
      seconds += val1 * 3600;
    } else if (unit1.startsWith('m')) {
      seconds += val1 * 60;
    } else if (unit1.startsWith('s')) {
      seconds += val1;
    }

    // Handle compound "1 hour 20 minutes" pattern
    if (match[3] && match[4]) {
      const val2 = parseFloat(match[3]);
      const unit2 = match[4].toLowerCase();
      if (unit2.startsWith('m')) {
        seconds += val2 * 60;
      } else if (unit2.startsWith('s')) {
        seconds += val2;
      }
    }

    if (seconds > 0) {
      parts.push({ text: match[0], seconds });
    } else {
      parts.push({ text: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining plain text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  // If no matches, return the whole text as plain
  if (parts.length === 0) {
    parts.push({ text });
  }

  return parts;
}

// Format seconds as "8m", "1h 20m", "45s"
export function formatTime(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  if (totalSeconds <= 0) return '0s';

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// Play a short beep via Web Audio API (no external files)
export function playBeep(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    // Clean up after playback
    oscillator.onended = () => ctx.close();
  } catch {
    // Silently fail if Web Audio API is not available
  }
}
