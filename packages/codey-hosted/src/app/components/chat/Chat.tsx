"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string; // ISO
};

const MSG_KEY_PREFIX = "codey.session.messages.";
const SESSIONS_KEY = "codey.sessions";

type SessionMeta = {
  id: string;
  workspaceRoot: string;
  model?: string;
  createdAt: string;
};

function loadMessages(sessionId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_KEY_PREFIX + sessionId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(sessionId: string, messages: Message[]) {
  try {
    localStorage.setItem(MSG_KEY_PREFIX + sessionId, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export default function Chat() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = routeParams?.id;
    if (!id) return;
    setSessionId(id);
    setMessages(loadMessages(id));

    // Load workspaceRoot from stored sessions
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as SessionMeta[];
        const found = Array.isArray(arr) ? arr.find((s) => s.id === id) : null;
        if (found?.workspaceRoot) {
          setWorkspaceRoot(found.workspaceRoot);
        } else {
          setError(
            "Missing workspaceRoot for this session. Return to home and recreate the session."
          );
        }
      } else {
        setError(
          "No sessions metadata found. Return to home and recreate the session."
        );
      }
    } catch {
      setError("Failed to load session metadata from storage.");
    }
  }, [routeParams]);

  useEffect(() => {
    if (!sessionId) return;
    saveMessages(sessionId, messages);
  }, [sessionId, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !sending && !!sessionId,
    [input, sending, sessionId]
  );

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    const text = input.trim();
    setInput("");

    const userMsg: Message = {
      id: "m_" + Math.random().toString(36).slice(2, 10),
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, workspaceRoot }),
      });
      const json = (await res.json()) as {
        response?: string;
        error?: string;
      };
      if (!res.ok || !json.response) {
        throw new Error(json.error || "Failed to send message");
      }

      const assistantMsg: Message = {
        id: "m_" + Math.random().toString(36).slice(2, 10),
        role: "assistant",
        text: json.response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-3">
        <button
          className="text-sm opacity-70 hover:opacity-100 transition"
          onClick={() => router.push("/")}
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Session {sessionId}</h1>
      </div>

      <div className="min-h-[50vh] max-h-[60vh] overflow-y-auto rounded-lg border border-black/10 dark:border-white/15 p-4 flex flex-col gap-3 bg-background">
        {messages.length === 0 ? (
          <p className="text-sm opacity-70">No messages yet. Say something!</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "self-end max-w-[80%] rounded-lg px-3 py-2 bg-foreground text-background"
                  : "self-start max-w-[80%] rounded-lg px-3 py-2 bg-black/5 dark:bg-white/10"
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col gap-2">
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 min-h-[48px] max-h-[160px] rounded-md border border-black/10 dark:border-white/15 px-3 py-2 bg-transparent outline-none"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            className="rounded-md px-4 py-2 bg-foreground text-background disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90 transition"
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
        <p className="text-xs opacity-70">Press ⌘/Ctrl+Enter to send</p>
      </div>
    </div>
  );
}


