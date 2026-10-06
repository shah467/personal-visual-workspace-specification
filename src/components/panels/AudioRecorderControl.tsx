"use client";

import { useRef, useState } from "react";
import { useWorkspace } from "@/state/workspace-provider";

export function AudioRecorderControl({ nodeId }: { nodeId: string }) {
  const workspace = useWorkspace();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsed(0);
        setUploading(true);
        try {
          const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type });
          await workspace.uploadAttachment(nodeId, "audio", file);
        } catch {
          setError("Failed to save recording.");
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError("Microphone access was denied or unavailable.");
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={uploading}
          className={
            recording
              ? "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--danger)] text-white"
              : "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
          }
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <span className="h-3 w-3 rounded-sm bg-white" /> : "●"}
        </button>
        <div className="text-xs text-[var(--ink-muted)]">
          {uploading ? "Saving…" : recording ? `Recording… ${formatTime(elapsed)}` : "Record a voice note"}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
