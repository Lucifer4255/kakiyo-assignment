"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useProspects, useCreateProspect, useDeleteProspect } from "@/hooks/use-prospects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, ChevronRight, X, ImagePlus, Trash2 } from "lucide-react";

const STATUS_COLORS = {
  pending: "secondary",
  enriching: "outline",
  ready: "default",
  failed: "destructive",
} as const;

type Source = { type: string; value?: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProspectsPage() {
  const { data: prospects, isLoading } = useProspects();
  const create = useCreateProspect();
  const del = useDeleteProspect();

  function handleDelete(e: React.MouseEvent, id: string, pname: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${pname}"? This also removes its conversations and messages.`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success("Prospect deleted"),
      onError: (err) => toast.error(err.message),
    });
  }
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sources, setSources] = useState<Source[]>([{ type: "github", value: "" }]);
  const [screenshots, setScreenshots] = useState<{ name: string; data: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function addSource() {
    setSources((s) => [...s, { type: "website", value: "" }]);
  }

  function removeSource(i: number) {
    setSources((s) => s.filter((_, idx) => idx !== i));
  }

  function updateSource(i: number, field: keyof Source, val: string) {
    setSources((s) => s.map((src, idx) => (idx === i ? { ...src, [field]: val } : src)));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length !== files.length) {
      toast.error("Only image files are accepted");
    }
    const encoded = await Promise.all(
      images.map(async (f) => ({ name: f.name, data: await fileToBase64(f) }))
    );
    setScreenshots((prev) => [...prev, ...encoded]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetForm() {
    setCreating(false);
    setName("");
    setSources([{ type: "github", value: "" }]);
    setScreenshots([]);
  }

  async function handleCreate() {
    if (!name.trim()) return toast.error("Name required");
    const validSources = sources.filter((s) => s.value?.trim());
    if (validSources.length === 0 && screenshots.length === 0) {
      return toast.error("Add at least one source or screenshot");
    }
    try {
      await create.mutateAsync({
        name,
        sources: validSources,
        screenshots: screenshots.map((s) => s.data),
      });
      resetForm();
      toast.success("Prospect saved — enrichment started");
    } catch (e) {
      toast.error((e as Error).message);
    }
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

            <p className="text-xs font-medium text-zinc-500">URL sources</p>
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
                  <option value="other">Other URL</option>
                </select>
                <Input
                  placeholder="https://…"
                  value={s.value ?? ""}
                  onChange={(e) => updateSource(i, "value", e.target.value)}
                  className="flex-1"
                />
                {sources.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeSource(i)}>
                    <X className="h-4 w-4 text-zinc-400" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addSource} className="self-start">
              + Add URL source
            </Button>

            <div className="border-t pt-3 mt-1">
              <p className="text-xs font-medium text-zinc-500 mb-2">LinkedIn screenshots</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 mr-1" /> Upload screenshot
              </Button>
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {screenshots.map((s, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.data}
                        alt={s.name}
                        className="h-20 w-20 object-cover rounded border"
                      />
                      <button
                        onClick={() => setScreenshots((p) => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-zinc-900 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-1">
              <Button onClick={handleCreate} disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save & enrich"}
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => handleDelete(e, p.id, p.name)}
                    >
                      <Trash2 className="h-4 w-4 text-zinc-400" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
