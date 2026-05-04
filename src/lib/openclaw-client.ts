const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || "http://localhost:18789";
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || "";

export interface OpenClawReply {
  reply: string;
  confidence?: number;
  openclawId?: string;
  handoff?: boolean;
}

export async function sendToDaniel(payload: {
  conversationId: string;
  candidateId: string;
  message: string;
  channel: string;
  context?: {
    candidateName?: string | null;
    position?: string | null;
    status?: string;
  };
}): Promise<OpenClawReply | null> {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/webhook/recruit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENCLAW_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getConversationMessages(openclawId: string) {
  try {
    const res = await fetch(
      `${OPENCLAW_API_URL}/api/conversations/${openclawId}/messages`,
      {
        headers: { Authorization: `Bearer ${OPENCLAW_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function testConnection(): Promise<{
  ok: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OPENCLAW_API_URL}/api/health`, {
      headers: { Authorization: `Bearer ${OPENCLAW_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, version: data.version };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
}
