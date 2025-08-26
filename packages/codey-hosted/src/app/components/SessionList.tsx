"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SessionMeta = {
  id: string;
  workspaceRoot: string;
  model?: string;
  createdAt: string; // ISO string
};

const SESSIONS_KEY = "codey.sessions";

function loadSessions(): SessionMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionMeta[]) {
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export default function SessionList() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    const loaded = loadSessions();
    // Keep most recent first
    loaded.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setSessions(loaded);
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    function onFocus() {
      refreshSessions();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refreshSessions();
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === SESSIONS_KEY) {
        refreshSessions();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshSessions]);

  // Avoid overwriting storage with an empty list on initial mount
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }
    saveSessions(sessions);
  }, [sessions]);

  const hasValidWorkspace = useMemo(() => workspaceRoot.trim().length > 0, [
    workspaceRoot,
  ]);

  const onCreate = useCallback(async () => {
    if (!hasValidWorkspace || creating) return;
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceRoot, model: model || undefined }),
      });

      const json = (await res.json()) as { sessionId?: string; error?: string };
      if (!res.ok || !json.sessionId) {
        throw new Error(json.error || "Failed to create session");
      }

      const newSession: SessionMeta = {
        id: json.sessionId,
        workspaceRoot,
        model: model || undefined,
        createdAt: new Date().toISOString(),
      };
      // Persist immediately to avoid losing the newly created session when navigating away
      setSessions((prev) => {
        const next = [newSession, ...prev];
        saveSessions(next);
        return next;
      });
      router.push(`/sessions/${json.sessionId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setCreating(false);
    }
  }, [creating, hasValidWorkspace, model, router, workspaceRoot]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl">
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-black/10 dark:border-white/15 bg-background">
        <h2 className="text-lg font-semibold">Create a new session</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="flex-1 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 bg-transparent outline-none"
            placeholder="Workspace root (absolute path)"
            value={workspaceRoot}
            onChange={(e) => setWorkspaceRoot(e.target.value)}
          />
          <input
            className="sm:w-48 rounded-md border border-black/10 dark:border-white/15 px-3 py-2 bg-transparent outline-none"
            placeholder="Model (optional)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <button
            className="sm:w-44 rounded-md px-4 py-2 bg-foreground text-background disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition"
            onClick={onCreate}
            disabled={!hasValidWorkspace || creating}
          >
            {creating ? "Creating..." : "Create session"}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Existing sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm opacity-70">No sessions yet. Create one above.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10 rounded-lg border border-black/10 dark:border-white/15 overflow-hidden">
            {sessions.map((s) => (
              <li key={s.id} className="bg-background">
                <button
                  className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
                  onClick={() => router.push(`/sessions/${s.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{s.id}</span>
                      <span className="text-xs opacity-70 truncate max-w-[60ch]">
                        {s.workspaceRoot}
                      </span>
                    </div>
                    <span className="text-xs opacity-70">
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


