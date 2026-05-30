"use client";
import { useState } from "react";
import { usePrompts, useCreatePrompt, useUpdatePrompt, useDeletePrompt } from "@/hooks/use-prompts";
import type { Prompt } from "@/hooks/use-prompts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Star } from "lucide-react";

const DEFAULT_SYSTEM_PROMPT = `You write cold outreach messages that are short, specific, and human.
Rules: no fluff, no "I hope this finds you well", no generic compliments.
Lead with something specific about them. One clear CTA. Under 150 words.`;

export default function PromptsPage() {
  const { data: prompts, isLoading } = usePrompts();
  const create = useCreatePrompt();
  const update = useUpdatePrompt();
  const del = useDeletePrompt();

  const [editing, setEditing] = useState<Prompt | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", systemPrompt: DEFAULT_SYSTEM_PROMPT });

  function startCreate() {
    setEditing(null);
    setForm({ name: "", systemPrompt: DEFAULT_SYSTEM_PROMPT });
    setCreating(true);
  }

  function startEdit(p: Prompt) {
    setCreating(false);
    setEditing(p);
    setForm({ name: p.name, systemPrompt: p.systemPrompt });
  }

  async function handleSave() {
    if (!form.name || !form.systemPrompt) return toast.error("All fields required");
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...form }).catch((e) => toast.error(e.message));
      setEditing(null);
    } else {
      await create.mutateAsync(form).catch((e) => toast.error(e.message));
      setCreating(false);
    }
    toast.success("Saved");
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" /> New prompt
        </Button>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        Your system prompt is sent verbatim to the AI. Edit it to control tone, length, and style.
      </p>

      {(creating || editing) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Edit prompt" : "New prompt"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Textarea
              placeholder="System prompt — sent verbatim to the AI"
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
                Save
              </Button>
              {editing && (
                <Button
                  variant="outline"
                  onClick={() => update.mutate({ id: editing.id, isDefault: true })}
                >
                  <Star className="h-4 w-4 mr-1" /> Set default
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : prompts?.length === 0 ? (
        <p className="text-sm text-zinc-400 mt-8">
          No prompts yet. Your system prompt steers the AI&apos;s tone and style — create one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {prompts?.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => startEdit(p)}>
              <CardContent className="flex items-start justify-between pt-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{p.name}</p>
                    {p.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono line-clamp-2">{p.systemPrompt}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 ml-2"
                  onClick={(e) => { e.stopPropagation(); del.mutate(p.id); }}
                >
                  <Trash2 className="h-4 w-4 text-zinc-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
