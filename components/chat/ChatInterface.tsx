"use client";

import { Copy, Loader2, Send } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationTurn, Generation, OrchestrationSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  at: number;
  imageUrl?: string;
  beforeImageUrl?: string;
  traceId?: string;
  statusText?: string;
  progress?: number;
}

interface ChatInterfaceProps {
  generation: Generation;
  productImageUrl?: string;
  orchestration?: OrchestrationSummary | null;
  onIteration?: (message: string) => void;
  onImageUpdate?: (imageUrl: string) => void;
  onHistoryChange?: (turns: ConversationTurn[]) => void;
  conversationHistory: ConversationTurn[];
  isProcessing: boolean;
}

function strategyLabel(strategy: string): string {
  switch (strategy) {
    case "modify":
      return "Modify";
    case "reuse_background":
      return "Reuse background";
    case "new":
      return "New scene";
    default:
      return strategy;
  }
}

function formatRelativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

async function readIterateStream(
  body: ReadableStream<Uint8Array> | null,
  onEvent: (evt: Record<string, unknown>) => void,
): Promise<void> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const jsonText = line.replace(/^data:\s*/, "");
      try { onEvent(JSON.parse(jsonText) as Record<string, unknown>); } catch { /* ignore malformed */ }
    }
  }
}

export function ChatInterface({
  generation,
  productImageUrl,
  orchestration,
  onIteration,
  onImageUpdate,
  onHistoryChange,
  conversationHistory,
  isProcessing,
}: ChatInterfaceProps) {
  const messagesRef = useRef<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [compareByMessageId, setCompareByMessageId] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const mapped = conversationHistory.map((t, i) => ({
      id: `hist-${i}-${t.timestamp}`,
      role: t.role,
      content: t.content,
      at: Date.parse(t.timestamp) || Date.now(),
    }));
    messagesRef.current = mapped;
    return mapped;
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const toConversationTurns = useCallback((msgs: ChatMessage[]): ConversationTurn[] =>
    msgs
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim().length > 0))
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content, timestamp: new Date(m.at).toISOString() })),
  []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const suggestionChips = useMemo(() => ["Make it warmer", "Add a headline", "Try different background"], []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || pending || isProcessing) return;
    setInput("");
    const priorThread = [...messagesRef.current];
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text, at: Date.now() };
    const assistantId = `a-${Date.now()}`;
    const assistantShell: ChatMessage = { id: assistantId, role: "assistant", content: "", at: Date.now() };
    const nextThread = [...priorThread, userMsg, assistantShell];
    messagesRef.current = nextThread;
    setMessages(nextThread);
    onIteration?.(text);
    setPending(true);

    let accumulated = "";
    const baseImageUrl = generation.imageUrl;

    try {
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId: generation.id,
          userMessage: text,
          userIterationRequest: text,
          conversationHistory: toConversationTurns(priorThread),
          previousGenerationContext: {
            generationId: generation.id,
            model: generation.model,
            optimizedPrompt: generation.optimizedPrompt,
            parameters: generation.parameters,
            orchestration: orchestration ?? null,
          },
          currentState: {
            imageUrl: generation.imageUrl,
            parameters: {
              ...(productImageUrl ? { productImageUrl } : {}),
              backgroundUrl: generation.imageUrl,
              generationModel: generation.model,
              generationPrompt: generation.optimizedPrompt,
              generationParameters: generation.parameters,
              ...(orchestration ? { orchestration } : {}),
            },
          },
        }),
      });

      if (!res.ok) {
        const bodyText = await res.text();
        let msg = "Something went wrong. Please try again.";
        if (!bodyText.trim().startsWith("<")) {
          try { const j = JSON.parse(bodyText) as { error?: string }; if (j.error) msg = j.error; } catch { /* keep default */ }
        }
        throw new Error(msg);
      }
      if (!res.body) throw new Error("No response body");

      await readIterateStream(res.body, (evt) => {
        const type = evt["type"];
        if (type === "thinking" && typeof evt["content"] === "string") {
          accumulated += evt["content"];
          setMessages((m) => {
            const next = m.map((msg) => (msg.id === assistantId ? { ...msg, content: accumulated } : msg));
            messagesRef.current = next;
            return next;
          });
        }
        if (type === "action" && typeof evt["action"] === "string") {
          const action = evt["action"];
          setMessages((m) => {
            const next = m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    statusText: `Action: ${String(action).replaceAll("_", " ")}`,
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }
        if (type === "status") {
          const message = typeof evt["message"] === "string" ? evt["message"] : undefined;
          const progress = typeof evt["progress"] === "number" ? Math.max(0, Math.min(1, evt["progress"])) : undefined;
          setMessages((m) => {
            const next = m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    ...(message ? { statusText: message } : {}),
                    ...(progress !== undefined ? { progress } : {}),
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }
        if (type === "result") {
          const explanation = typeof evt["explanation"] === "string" ? evt["explanation"] : "";
          const imageUrl = typeof evt["imageUrl"] === "string" ? evt["imageUrl"] : generation.imageUrl;
          const traceId = typeof evt["traceId"] === "string" ? evt["traceId"] : undefined;
          const clarify = Boolean(evt["clarify"]);
          const finalText = clarify
            ? `${explanation}\n\n${typeof evt["question"] === "string" ? evt["question"] : ""}`
            : `${accumulated ? `${accumulated}\n\n` : ""}${explanation}`.trim();
          const withTrace = traceId ? `${finalText}\n\n(trace ${traceId})` : finalText;
          setMessages((m) => {
            const next = m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: withTrace || explanation,
                    imageUrl,
                    beforeImageUrl: !clarify ? baseImageUrl : undefined,
                    traceId,
                    statusText: undefined,
                    progress: clarify ? undefined : 1,
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
          if (!clarify && imageUrl && imageUrl !== generation.imageUrl) {
            onImageUpdate?.(imageUrl);
          }
        }
        if (type === "error" && typeof evt["message"] === "string") {
          const traceId = typeof evt["traceId"] === "string" ? evt["traceId"] : undefined;
          setMessages((m) => {
            const next = m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `Error: ${evt["message"] as string}${traceId ? ` (trace ${traceId})` : ""}`,
                    traceId,
                  }
                : msg,
            );
            messagesRef.current = next;
            return next;
          });
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setMessages((m) => {
        const next = m.map((x) => (x.id === assistantId ? { ...x, content: `Error: ${msg}`, statusText: undefined } : x));
        messagesRef.current = next;
        return next;
      });
    } finally {
      setPending(false);
      queueMicrotask(() => { onHistoryChange?.(toConversationTurns(messagesRef.current)); });
    }
  }, [generation.id, generation.imageUrl, input, isProcessing, onHistoryChange, onImageUpdate, onIteration, pending, productImageUrl, toConversationTurns]);

  const busy = pending || isProcessing;

  return (
    <div className="flex h-[min(640px,70vh)] w-full max-w-md flex-col rounded-2xl glass shadow-glass">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <h2 className="text-base font-semibold text-white">Refine with chat</h2>
        {orchestration && (
          <p className="mt-1 text-xs text-zinc-500">
            {orchestration.adType} · {strategyLabel(orchestration.generationStrategy)} ·{" "}
            {orchestration.targetPlatform}
            {orchestration.topEditOperation ? ` · action: ${orchestration.topEditOperation}` : ""}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
              m.role === "user" && "ml-auto bg-violet-600 text-white shadow-glow-violet",
              m.role === "assistant" && "mr-auto bg-white/[0.06] text-zinc-200 ring-1 ring-white/[0.06]",
              m.role === "system" && "mx-auto bg-transparent text-center text-xs text-zinc-600",
            )}
          >
            {m.imageUrl && m.role === "assistant" && (
              <div className="mb-2 w-full max-w-[220px]">
                {m.beforeImageUrl ? (
                  <div className="space-y-1.5">
                    <div className="relative aspect-video overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900">
                      <Image src={m.imageUrl} alt="" fill className="object-cover" unoptimized />
                      <div
                        className="pointer-events-none absolute inset-0 overflow-hidden"
                        style={{
                          clipPath: `inset(0 ${100 - (compareByMessageId[m.id] ?? 50)}% 0 0)`,
                        }}
                      >
                        <Image src={m.beforeImageUrl} alt="" fill className="object-cover" unoptimized />
                      </div>
                      <div
                        className="pointer-events-none absolute top-0 h-full w-px bg-white/80"
                        style={{ left: `${compareByMessageId[m.id] ?? 50}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Before</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={compareByMessageId[m.id] ?? 50}
                        onChange={(e) =>
                          setCompareByMessageId((prev) => ({
                            ...prev,
                            [m.id]: Number(e.target.value),
                          }))
                        }
                        className="h-1.5 flex-1 accent-violet-400"
                      />
                      <span className="text-[10px] text-zinc-500">After</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-video overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900">
                    <Image src={m.imageUrl} alt="" fill className="object-cover" unoptimized />
                  </div>
                )}
              </div>
            )}
            {m.role === "assistant" && !m.content && pending ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden />
                <span>Thinking…</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
            <p className="mt-1 text-[10px] opacity-50">{formatRelativeTime(m.at)}</p>
            {m.role === "assistant" && (m.statusText || typeof m.progress === "number") && pending && (
              <div className="mt-1 space-y-1">
                {m.statusText && <p className="text-[10px] text-zinc-400">{m.statusText}</p>}
                {typeof m.progress === "number" && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full bg-violet-400 transition-all duration-200"
                      style={{ width: `${Math.round(m.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {m.role === "assistant" && m.traceId && (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(m.traceId!)
                    .then(() => toast.success("Trace ID copied"))
                    .catch(() => toast.error("Could not copy trace ID"))
                }
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copy trace
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1 pt-2">
          {suggestionChips.map((c) => (
            <button
              key={c}
              type="button"
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-400 transition hover:border-violet-500/40 hover:bg-violet-500/[0.08] hover:text-violet-300 disabled:opacity-40"
              disabled={busy}
              onClick={() => setInput(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t border-white/[0.06] p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe changes you want..."
          disabled={busy}
          className="flex-1 border-white/[0.08] bg-white/[0.04] text-sm text-white placeholder:text-zinc-600 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          aria-label="Chat message"
        />
        <Button
          type="button"
          size="icon"
          disabled={busy || !input.trim()}
          onClick={() => void send()}
          aria-label="Send"
          className="bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
