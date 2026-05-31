"use client";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, MessagesSquare, Reply, Star, Heart } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
          <Icon className="h-4 w-4 text-zinc-300" />
        </div>
        <p className="text-3xl font-semibold mt-2 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-56 w-full mt-6" />
      </div>
    );
  }

  const a = data;
  const hasData = a && (a.prospects > 0 || a.messages > 0);
  const replyRate =
    a && a.conversations > 0 ? Math.round((a.replies / a.conversations) * 100) : 0;
  const maxUsage = a ? Math.max(1, ...a.offeringUsage.map((o) => o.count)) : 1;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-zinc-500 mb-6">Your outreach activity at a glance.</p>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-400">
            No activity yet. Add a prospect and generate your first message to see analytics here.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Prospects" value={a!.prospects} icon={Users} />
            <StatCard label="Messages generated" value={a!.messages} icon={Mail} />
            <StatCard label="Conversations" value={a!.conversations} icon={MessagesSquare} />
            <StatCard
              label="Replies"
              value={a!.replies}
              sub={`${replyRate}% of conversations`}
              icon={Reply}
            />
          </div>

          {/* Quality signals */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <StatCard
              label="Avg rating"
              value={a!.avgRating != null ? `${a!.avgRating}★` : "—"}
              sub="across rated messages"
              icon={Star}
            />
            <StatCard
              label="Favorited"
              value={a!.favorites}
              sub="messages you starred"
              icon={Heart}
            />
          </div>

          {/* Messages by offering — horizontal bars */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Messages by offering</CardTitle>
            </CardHeader>
            <CardContent>
              {a!.offeringUsage.length === 0 ? (
                <p className="text-sm text-zinc-400">No messages generated yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {a!.offeringUsage.map((o) => (
                    <div key={o.name} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-sm text-zinc-600 truncate" title={o.name}>
                        {o.name}
                      </div>
                      <div className="flex-1 bg-zinc-100 rounded h-6 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded transition-all"
                          style={{ width: `${(o.count / maxUsage) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 shrink-0 text-sm tabular-nums text-zinc-600 text-right">
                        {o.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
