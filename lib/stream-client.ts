/** Stream a text response from a POST endpoint, invoking onChunk with each delta.
 *  Returns response headers (e.g. X-Conversation-Id) once the stream completes. */
export async function streamText(
  url: string,
  body: unknown,
  onChunk: (delta: string) => void
): Promise<Headers> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }

  return res.headers;
}
