"use client";
import { useState } from "react";
import Link from "next/link";
import { useProspects, useCreateProspect } from "@/hooks/use-prospects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, ChevronRight } from "lucide-react";

const STATUS_COLORS = {
  pending: "secondary",
  enriching: "outline",
  ready: "default",
  failed: "destructive",
} as const;

type Source = { type: string; value?: string };

export default function ProspectsPage() {
  const { data: prospects, isLoading } = useProspects();
  const create = useCreateProspect();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sources, setSources] = useState<Source[]>([{ type: "github", value: "" }]);

  function addSource() {
    setSources((s) => [...s, { type: "website", value: "" }]);
  }

  function updateSource(i: number, field: keyof Source, val: string) {
    setSources((s) => s.map((src, idx) => idx === i ? { ...src, [field]: val } : src));
  }

  async function handleCreate() {
    if (!name.trim()) return toast.error("Name required");
    const validSources = sources.filter((s) => s.value?.trim());
    await create
      .mutateAsync({ name, sources: validSources })
      .catch((e) => toast.error(e.message));
    setCreating(false);
    setName("");
    setSources([{ type: "github", value: "" }]);
    toast.success("Prospect saved — enrichment started");
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Prospects</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> New prospect
        </Button>
      </div>

      {creating && (
        <Card className="mb-6">
          <CardContent className="pt-4 flex flex-col gap-3">
            <Input
              placeholder="Prospect name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs font-medium text-zinc-500">Sources</p>
            {sources.map((s, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className="border rounded-md px-2 py-1.5 text-sm bg-white"
                  value={s.type}
                  onChange={(e) => updateSource(i, "type", e.target.value)}
                >
                  <option value="github">GitHub</option>
                  <option value="website">Website</option>
                  <option value="company">Company</option>
                  <option value="linkedin_screenshot">LinkedIn (screenshot)</option>
                  <option value="other">Other URL</option>
                </select>
                <Input
                  placeholder="URL"
                  value={s.value ?? ""}
                  onChange={(e) => updateSource(i, "value", e.target.value)}
                  className="flex-1"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSource} className="self-start">
              + Add source
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save & enrich"}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : prospects?.length === 0 ? (
        <p className="text-sm text-zinc-400 mt-8">
          No prospects yet. Add one with a GitHub URL, website, or LinkedIn screenshot.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {prospects?.map((p) => (
            <Link key={p.id} href={`/prospects/${p.id}`}>
              <Card className="hover:bg-zinc-50 transition-colors">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <Badge variant={STATUS_COLORS[p.enrichmentStatus]} className="text-xs mt-1">
                      {p.enrichmentStatus}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
