import { useMutation } from "@tanstack/react-query";

const fetch$ = (url: string, init?: RequestInit) =>
  fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function useAssist() {
  return useMutation<
    { improved: string },
    Error,
    { kind: "prompt" | "offering"; text?: string; instruction?: string }
  >({
    mutationFn: (data) =>
      fetch$("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}
