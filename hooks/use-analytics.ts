import { useQuery } from "@tanstack/react-query";

export type Analytics = {
  prospects: number;
  messages: number;
  conversations: number;
  replies: number;
  favorites: number;
  avgRating: number | null;
  offeringUsage: { name: string; count: number }[];
};

export function useAnalytics() {
  return useQuery<Analytics>({
    queryKey: ["analytics"],
    queryFn: () =>
      fetch("/api/analytics").then((r) => {
        if (!r.ok) throw new Error("Failed to load analytics");
        return r.json();
      }),
  });
}
