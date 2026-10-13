export interface SseEvent {
  id: string | null;
  event: string;
  data: string;
}

/**
 * Parse as many complete server-sent events as `buffer` contains.
 * Returns the parsed events and the unconsumed remainder (an incomplete event).
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const normalised = buffer.replace(/\r\n/g, "\n");
  const blocks = normalised.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let id: string | null = null;
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue; // comment / keep-alive
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "id") id = value;
      else if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length || id !== null) events.push({ id, event, data: data.join("\n") });
  }
  return { events, rest };
}

/** Read a `text/event-stream` response body as an async sequence of events. */
export async function* readSse(response: Response): AsyncGenerator<SseEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSse(buffer);
      buffer = parsed.rest;
      for (const ev of parsed.events) yield ev;
    }
  } finally {
    reader.releaseLock();
  }
}
