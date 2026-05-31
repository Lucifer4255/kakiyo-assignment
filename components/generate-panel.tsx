"use client";
import { useState, type ReactElement } from "react";
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
import { Copy, Heart, Trash2, GitBranch, Sparkles, Star, Reply, ChevronLeft, ChevronRight } from "lucide-react";

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
  parentId: string | null;
  branchFromMessageId: string | null;
  branchTone: string | null;
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

  // Which variant (Default / a branch) is shown per thread family, keyed by root id
  const [variantIdx, setVariantIdx] = useState<Record<string, number>>({});

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

  // Branch a thread from a specific assistant message, re-toned. The server copies
  // everything before that message into a new conversation and regenerates it.
  async function branchFrom(convId: string, messageId: string, tone: string, label: string) {
    setStreaming(true);
    setStreamedText("");
    try {
      await streamText(
        `/api/conversations/${convId}/branch`,
        { fromMessageId: messageId, tone, toneLabel: label },
        (delta) => setStreamedText((prev) => prev + delta)
      );
      await new Promise((r) => setTimeout(r, 600));
      await qc.invalidateQueries({ queryKey: ["prospects", prospectId] });
      setStreamedText("");
      // Jump this message's pager to the newly created branch (appended last)
      setVariantIdx((v) => ({ ...v, [messageId]: Number.MAX_SAFE_INTEGER }));
      toast.success(`Branched · ${label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  const offeringName = (id: string) => offerings?.find((o) => o.id === id)?.name ?? "Offering";

  // Roots = conversations that aren't a branch (or whose parent isn't shown).
  const shownIds = new Set(conversations.map((c) => c.id));
  const roots = conversations.filter((c) => !c.parentId || !shownIds.has(c.parentId));

  if (!ready) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-zinc-400">
          Generate a message once enrichment is complete.
        </CardContent>
      </Card>
    );
  }

  // Branches of conversation `convId` that diverged at message `msgId`.
  const branchesFrom = (convId: string, msgId: string) =>
    conversations.filter((c) => c.parentId === convId && c.branchFromMessageId === msgId);

  const displayMsgs = (c: Conversation) => c.messages.filter((m) => !m.inherited);

  const renderMessage = (conv: Conversation, m: Message): ReactElement => (
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
      {m.tone && <p className="text-xs text-zinc-400 mt-1 italic">tone: {m.tone}</p>}

      {m.role === "assistant" && (
        <>
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

          {/* Branch this message into a re-toned variant */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> Branch:
            </span>
            {TONES.map((t) => (
              <Button
                key={t.label}
                variant="outline" size="sm" className="h-6 text-xs px-2"
                disabled={streaming}
                onClick={() => branchFrom(conv.id, m.id, t.value, t.label)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderReplyBox = (conv: Conversation): ReactElement => (
    <div key={`reply-${conv.id}`} className="flex flex-col gap-2">
      {replyingId === conv.id && (
        <div className="py-1 border-l-2 border-emerald-300 pl-3 bg-emerald-50/30 rounded-r">
          <p className="text-sm whitespace-pre-wrap text-zinc-800">
            {replyStreamed}
            <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 border-t pt-3">
        <Textarea
          placeholder="Paste the prospect's reply here to draft a follow-up…"
          value={replyDraft[conv.id] ?? ""}
          onChange={(e) => setReplyDraft((d) => ({ ...d, [conv.id]: e.target.value }))}
          rows={2}
          className="text-sm"
        />
        <Button
          variant="secondary"
          size="sm"
          className="self-start h-7 text-xs"
          disabled={replyingId === conv.id || !(replyDraft[conv.id] ?? "").trim()}
          onClick={() => sendReply(conv.id)}
        >
          <Reply className="h-3.5 w-3.5 mr-1" />
          {replyingId === conv.id ? "Drafting…" : "Draft follow-up"}
        </Button>
      </div>
    </div>
  );

  // Render a conversation's messages from `start`. At any assistant message that
  // has branches, show a ‹ › version pager that swaps that message (and the rest
  // of the thread below it) between this track and each branch.
  const renderTrack = (conv: Conversation, start = 0): ReactElement => {
    const msgs = displayMsgs(conv);
    const nodes: ReactElement[] = [];
    for (let i = start; i < msgs.length; i++) {
      const m = msgs[i];
      const branches = m.role === "assistant" ? branchesFrom(conv.id, m.id) : [];
      if (branches.length === 0) {
        nodes.push(renderMessage(conv, m));
        continue;
      }
      // Branch point: variant 0 = stay on this track; 1..n = the branches.
      const variants = [conv, ...branches];
      const active = Math.min(Math.max(variantIdx[m.id] ?? 0, 0), variants.length - 1);
      const activeConv = variants[active];
      const go = (d: number) =>
        setVariantIdx((v) => ({
          ...v,
          [m.id]: Math.min(Math.max(active + d, 0), variants.length - 1),
        }));
      nodes.push(
        <div key={`pager-${m.id}`} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={active === 0} onClick={() => go(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {activeConv.branchTone ? (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <GitBranch className="h-3 w-3" /> {activeConv.branchTone}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Default</Badge>
            )}
            <span className="text-xs text-zinc-400 tabular-nums">{active + 1} / {variants.length}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={active === variants.length - 1} onClick={() => go(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {active === 0 ? (
            <>
              {renderMessage(conv, m)}
              {renderTrack(conv, i + 1)}
            </>
          ) : (
            renderTrack(activeConv, 0)
          )}
        </div>
      );
      // The active track renders everything from this point down.
      return <>{nodes}</>;
    }
    nodes.push(renderReplyBox(conv));
    return <>{nodes}</>;
  };

  const renderRoot = (root: Conversation): ReactElement => (
    <Card key={root.id}>
      <CardContent className="pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{offeringName(root.offeringId)}</Badge>
          <span className="text-xs text-zinc-400">{new Date(root.createdAt).toLocaleString()}</span>
        </div>
        {renderTrack(root)}
      </CardContent>
    </Card>
  );

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

      {/* One card per thread; ‹ › at a branched message swaps it (and the rest) */}
      {roots.map((root) => renderRoot(root))}
    </div>
  );
}
