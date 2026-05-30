"use client";
import { useParams } from "next/navigation";
import { useProspect } from "@/hooks/use-prospects";
import type { ProspectProfile } from "@/lib/ai/schema";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_COLORS = {
  pending: "secondary",
  enriching: "outline",
  ready: "default",
  failed: "destructive",
} as const;

function ProfileView({ profile }: { profile: ProspectProfile }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-700">{profile.headline}</p>
        {profile.company && <p className="text-sm text-zinc-500">{profile.role} @ {profile.company}</p>}
        {profile.location && <p className="text-xs text-zinc-400">{profile.location}</p>}
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Background</p>
        <p className="text-sm text-zinc-700">{profile.background}</p>
      </div>

      {profile.personalizationHooks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Personalization hooks</p>
          <ul className="flex flex-col gap-1">
            {profile.personalizationHooks.map((h, i) => (
              <li key={i} className="text-sm text-zinc-700 flex gap-2">
                <span className="text-emerald-500 shrink-0">→</span>{h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.recentSignals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Recent signals</p>
          <ul className="flex flex-col gap-1">
            {profile.recentSignals.map((s, i) => (
              <li key={i} className="text-sm text-zinc-600">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {profile.technicalProfile && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Technical profile</p>
          <p className="text-sm text-zinc-700">{profile.technicalProfile}</p>
        </div>
      )}

      {profile.likelyPainPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Likely pain points</p>
          <ul className="flex flex-col gap-1">
            {profile.likelyPainPoints.map((p, i) => (
              <li key={i} className="text-sm text-zinc-600">• {p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useProspect(id);

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!data) return <div className="p-8 text-zinc-400 text-sm">Prospect not found.</div>;

  const profile = data.profile as ProspectProfile | null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <Badge variant={STATUS_COLORS[data.enrichmentStatus as keyof typeof STATUS_COLORS]}>
          {data.enrichmentStatus}
        </Badge>
      </div>

      {profile ? (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-sm">Enriched profile</CardTitle></CardHeader>
          <CardContent><ProfileView profile={profile} /></CardContent>
        </Card>
      ) : (
        <div className="text-sm text-zinc-400 mb-6 p-4 border rounded-lg bg-zinc-50">
          {data.enrichmentStatus === "enriching"
            ? "Enrichment in progress — refresh in a few seconds."
            : data.enrichmentStatus === "failed"
            ? "Enrichment failed. Check source URLs and retry."
            : "Profile will appear here after enrichment completes."}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Sources</CardTitle></CardHeader>
        <CardContent>
          {data.sources?.length === 0 ? (
            <p className="text-sm text-zinc-400">No sources.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.sources?.map((s: { id: string; type: string; value: string | null; rawExtracted: string | null }) => (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">{s.type}</Badge>
                  <span className="text-zinc-600 truncate">{s.value ?? "screenshot"}</span>
                  {s.rawExtracted && <span className="text-emerald-500 text-xs shrink-0">✓ extracted</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-zinc-400 p-4 border rounded-lg bg-zinc-50">
        Generate panel — coming in P3.
      </div>
    </div>
  );
}
