import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type Prompt = {
  id: string;
  userId: string;
  name: string;
  systemPrompt: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const fetch$ = (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function usePrompts() {
  return useQuery<Prompt[]>({
    queryKey: ["prompts"],
    queryFn: () => fetch$("/api/prompts"),
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation<Prompt, Error, { name: string; systemPrompt: string; isDefault?: boolean }>({
    mutationFn: (data) =>
      fetch$("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation<
    Prompt,
    Error,
    { id: string; name?: string; systemPrompt?: string; isDefault?: boolean }
  >({
    mutationFn: ({ id, ...data }) =>
      fetch$(`/api/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => fetch$(`/api/prompts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}
