import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Prospect = {
  id: string;
  userId: string;
  name: string;
  profile: Record<string, unknown> | null;
  enrichmentStatus: "pending" | "enriching" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
};

const fetch$ = (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function useProspects() {
  return useQuery<Prospect[]>({
    queryKey: ["prospects"],
    queryFn: () => fetch$("/api/prospects"),
  });
}

export function useProspect(id: string) {
  return useQuery({
    queryKey: ["prospects", id],
    queryFn: () => fetch$(`/api/prospects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProspect() {
  const qc = useQueryClient();
  return useMutation<
    Prospect,
    Error,
    { name: string; sources?: { type: string; value?: string }[]; screenshots?: string[] }
  >({
    mutationFn: (data) =>
      fetch$("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });
}

export function useUpdateProspect() {
  const qc = useQueryClient();
  return useMutation<Prospect, Error, { id: string; name?: string; profile?: unknown }>({
    mutationFn: ({ id, ...data }) =>
      fetch$(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["prospects", id] });
    },
  });
}

export function useDeleteProspect() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => fetch$(`/api/prospects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });
}
