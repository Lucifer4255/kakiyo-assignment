"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOfferings } from "@/hooks/use-offerings";
import { usePrompts } from "@/hooks/use-prompts";
import { useUpdateMessage, useDeleteMessage, type Message } from "@/hooks/use-messages";
import { streamText } from "@/lib/stream-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Heart, Trash2, RefreshCw, Sparkles, Star, Reply } from "lucide-react";

const TONES = [
  { label: "Direct", value: "more direct — get to the point faster" },
  { label: "Warm", value: "warmer and more personal" },
  { label: "Lead with pain point", value: "lead with the prospect's pain point" },
  { label: "Shorter", value: "shorter — under 60 words" },
];

type Conversation = {
  id: string;
  offeringId: string;
  promptId: string;
  createdAt: string;
  messages: Message[];
};

export function GeneratePanel({
  prospectId,
  ready,
  conversations,
}: {
  prospectId: string;
  ready: boolean;
  conversations: Conversation[];
}) {
  const qc = useQueryClient();
  const { data: offerings } = useOfferings();
  const { data: prompts } = usePrompts();
  const updateMsg = useUpdateMessage(prospectId);
  const deleteMsg = useDeleteMessage(prospectId);

  const [offeringId, setOfferingId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");

  // Per-conversation reply drafts + the thread currently streaming a follow-up
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyStreamed, setReplyStreamed] = useState("");

  // Default selections once data loads
  const effectiveOffering = offeringId || offerings?.[0]?.id || "";
  const effectivePrompt =
    promptId || prompts?.find((p) => p.isDefault)?.id || prompts?.[0]?.id || "";

  async function runGenerate(opts?: { offeringId?: string; promptId?: string; tone?: string }) {
    const oId = opts?.offeringId ?? effectiveOffering;
    const pId = opts?.promptId ?? effectivePrompt;
    if (!oId) return toast.error("Create an offering first");
    if (!pId) return toast.error("Create a prompt first");

    setStreaming(true);
    setStreamedText("");
    try {
      await streamText(
        "/api/generate",
        { prospectId, offeringId: oId, promptId: pId, tone: opts?.tone },
        (delta) => setStreamedText((prev) => prev + delta)
      );
      // Let the server commit the assistant message, then refetch the thread
      await new Promise((r) => setTimeout(r, 600));
      await qc.invalidateQueries({ queryKey: ["prospects", prospectId] });
      setStreamedText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  async function sendReply(convId: string) {
    const text = (replyDraft[convId] ?? "").trim();
    if (!text) return toast.error("Paste the prospect's reply first");

    setReplyingId(convId);
    setReplyStreamed("");
    try {
      await streamText(
        `/api/conversations/${convId}/reply`,
        { reply: text },
        (delta) => setReplyStreamed((prev) => prev + delta)
      );
      // Let the server commit both messages, then refetch the thread
      await new Promise((r) => setTimeout(r, 600));
      await qc.invalidateQueries({ queryKey: ["prospects", prospectId] });
      setReplyDraft((d) => ({ ...d, [convId]: "" }));
      setReplyStreamed("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReplyingId(null);
    }
  }

  const offeringName = (id: string) => offerings?.find((o) => o.id === id)?.name ?? "Offering";

  if (!ready) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-zinc-400">
          Generate a message once enrichment is complete.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Generate controls */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-md px-2 py-1.5 text-sm bg-white flex-1 min-w-40"
              value={effectiveOffering}
              onChange={(e) => setOfferingId(e.target.value)}
            >
              {offerings?.length ? (
                offerings.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))
              ) : (
                <option value="">No offerings</option>
              )}
            </select>
            <select
              className="border rounded-md px-2 py-1.5 text-sm bg-white flex-1 min-w-40"
              value={effectivePrompt}
              onChange={(e) => setPromptId(e.target.value)}
            >
              {prompts?.length ? (
                prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isDefault ? " (default)" : ""}
                  </option>
                ))
              ) : (
                <option value="">No prompts</option>
              )}
            </select>
          </div>
          <Button onClick={() => runGenerate()} disabled={streaming} className="self-start">
            <Sparkles className="h-4 w-4 mr-1" />
            {streaming ? "Generating…" : "Generate message"}
          </Button>
        </CardContent>
      </Card>

      {/* Live streaming preview */}
      {streaming && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-4">
            <p className="text-sm whitespace-pre-wrap text-zinc-800">
              {streamedText}
              <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
            </p>
          </CardContent>
        </Card>
      )}

      {/* Existing conversation threads */}
      {conversations.map((c) => (
        <Card key={c.id}>
          <CardContent className="pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{offeringName(c.offeringId)}</Badge>
              <span className="text-xs text-zinc-400">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>

            {c.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "prospect"
                    ? "border-l-2 border-zinc-300 pl-3 bg-zinc-50 rounded-r py-2"
                    : "py-1"
                }
              >
                {m.role === "prospect" && (
                  <p className="text-xs font-medium text-zinc-400 mb-1">Prospect replied</p>
                )}
                <p className="text-sm whitespace-pre-wrap text-zinc-800">{m.content}</p>
                {m.tone && (
                  <p className="text-xs text-zinc-400 mt-1 italic">tone: {m.tone}</p>
                )}

                {m.role === "assistant" && (
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => updateMsg.mutate({ id: m.id, isFavorite: !m.isFavorite })}
                    >
                      <Heart className={`h-3.5 w-3.5 ${m.isFavorite ? "fill-red-500 text-red-500" : "text-zinc-400"}`} />
                    </Button>
                    {/* rating */}
                    <div className="flex items-center ml-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => updateMsg.mutate({ id: m.id, rating: n === m.rating ? null : n })}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${m.rating && n <= m.rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
                          />
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 ml-auto"
                      onClick={() => deleteMsg.mutate(m.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-zinc-400" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Live streaming follow-up to the prospect's reply */}
            {replyingId === c.id && (
              <div className="py-1 border-l-2 border-emerald-300 pl-3 bg-emerald-50/30 rounded-r">
                <p className="text-sm whitespace-pre-wrap text-zinc-800">
                  {replyStreamed}
                  <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
                </p>
              </div>
            )}

            {/* Paste a reply → generate a natural follow-up that continues the thread */}
            <div className="flex flex-col gap-2 border-t pt-3">
              <Textarea
                placeholder="Paste the prospect's reply here to draft a follow-up…"
                value={replyDraft[c.id] ?? ""}
                onChange={(e) => setReplyDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                rows={2}
                className="text-sm"
              />
              <Button
                variant="secondary"
                size="sm"
                className="self-start h-7 text-xs"
                disabled={replyingId === c.id || !(replyDraft[c.id] ?? "").trim()}
                onClick={() => sendReply(c.id)}
              >
                <Reply className="h-3.5 w-3.5 mr-1" />
                {replyingId === c.id ? "Drafting…" : "Draft follow-up"}
              </Button>
            </div>

            {/* Regenerate with tone — no re-entry */}
            <div className="flex items-center gap-1.5 flex-wrap border-t pt-3">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Regenerate:
              </span>
              {TONES.map((t) => (
                <Button
                  key={t.label}
                  variant="outline" size="sm" className="h-7 text-xs"
                  disabled={streaming}
                  onClick={() => runGenerate({ offeringId: c.offeringId, promptId: c.promptId, tone: t.value })}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
