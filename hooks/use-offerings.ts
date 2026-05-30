import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Offering = {
  id: string;
  userId: string;
  name: string;
  content: string;
  sourceUrl: string | null;
  rawScraped: string | null;
  createdAt: string;
  updatedAt: string;
};

const fetch$ = (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function useOfferings() {
  return useQuery<Offering[]>({
    queryKey: ["offerings"],
    queryFn: () => fetch$("/api/offerings"),
  });
}

export function useCreateOffering() {
  const qc = useQueryClient();
  return useMutation<Offering, Error, { name: string; content: string; sourceUrl?: string }>({
    mutationFn: (data) =>
      fetch$("/api/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offerings"] }),
  });
}

export function useUpdateOffering() {
  const qc = useQueryClient();
  return useMutation<Offering, Error, { id: string; name?: string; content?: string }>({
    mutationFn: ({ id, ...data }) =>
      fetch$(`/api/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offerings"] }),
  });
}

export function useDeleteOffering() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => fetch$(`/api/offerings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["offerings"] }),
  });
}

export function useScrapeOffering() {
  return useMutation<{ scraped: string; suggestedContent: string }, Error, string>({
    mutationFn: (url) =>
      fetch$("/api/offerings/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
  });
}
