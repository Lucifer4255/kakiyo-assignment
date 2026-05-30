"use client";
import { useState } from "react";
import {
  useOfferings,
  useCreateOffering,
  useUpdateOffering,
  useDeleteOffering,
  useScrapeOffering,
} from "@/hooks/use-offerings";
import type { Offering } from "@/hooks/use-offerings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Globe } from "lucide-react";

export default function OfferingsPage() {
  const { data: offerings, isLoading } = useOfferings();
  const create = useCreateOffering();
  const update = useUpdateOffering();
  const del = useDeleteOffering();
  const scrape = useScrapeOffering();

  const [editing, setEditing] = useState<Offering | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", sourceUrl: "" });
  const [scrapeUrl, setScrapeUrl] = useState("");

  function startCreate() {
    setEditing(null);
    setForm({ name: "", content: "", sourceUrl: "" });
    setCreating(true);
  }

  function startEdit(o: Offering) {
    setCreating(false);
    setEditing(o);
    setForm({ name: o.name, content: o.content, sourceUrl: o.sourceUrl ?? "" });
  }

  async function handleScrape() {
    if (!scrapeUrl) return;
    const result = await scrape.mutateAsync(scrapeUrl).catch((e) => {
      toast.error(e.message);
      return null;
    });
    if (result) {
      setForm((f) => ({ ...f, content: result.suggestedContent, sourceUrl: scrapeUrl }));
      toast.success("Scraped and summarised");
    }
  }

  async function handleSave() {
    if (!form.name || !form.content) return toast.error("Name and content required");
    if (editing) {
      await update.mutateAsync({ id: editing.id, name: form.name, content: form.content }).catch((e) => toast.error(e.message));
      setEditing(null);
    } else {
      await create.mutateAsync({ name: form.name, content: form.content, sourceUrl: form.sourceUrl || undefined }).catch((e) => toast.error(e.message));
      setCreating(false);
    }
    toast.success("Saved");
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Offerings</h1>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4 mr-1" /> New offering
        </Button>
      </div>

      {(creating || editing) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Edit offering" : "New offering"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="Scrape a URL to auto-fill content"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleScrape}
                disabled={scrape.isPending}
              >
                <Globe className="h-4 w-4 mr-1" />
                {scrape.isPending ? "Scraping…" : "Scrape"}
              </Button>
            </div>
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Textarea
              placeholder="Offering content — what you do, who you serve, why it's different."
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={6}
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : offerings?.length === 0 ? (
        <p className="text-sm text-zinc-400 mt-8">
          No offerings yet. Create one to describe what you bring to prospects.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {offerings?.map((o) => (
            <Card key={o.id} className="cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => startEdit(o)}>
              <CardContent className="flex items-start justify-between pt-4">
                <div>
                  <p className="font-medium text-sm">{o.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{o.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 ml-2"
                  onClick={(e) => { e.stopPropagation(); del.mutate(o.id); }}
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
