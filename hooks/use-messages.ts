import { useMutation, useQueryClient } from "@tanstack/react-query";

export type Message = {
  id: string;
  conversationId: string;
  role: "assistant" | "prospect";
  content: string;
  tone: string | null;
  rating: number | null;
  isFavorite: boolean;
  inherited: boolean;
  createdAt: string;
};

const fetch$ = (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function useUpdateMessage(prospectId: string) {
  const qc = useQueryClient();
  return useMutation<Message, Error, { id: string; rating?: number | null; isFavorite?: boolean }>({
    mutationFn: ({ id, ...data }) =>
      fetch$(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects", prospectId] }),
  });
}

export function useDeleteMessage(prospectId: string) {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => fetch$(`/api/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects", prospectId] }),
  });
}
