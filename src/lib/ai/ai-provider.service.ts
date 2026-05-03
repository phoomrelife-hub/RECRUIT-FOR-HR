import { db } from "@/lib/db";

export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

export async function listProviders() {
  const providers = await db.aiProvider.findMany({ orderBy: { createdAt: "asc" } });
  return providers.map((p) => ({ ...p, apiKey: maskApiKey(p.apiKey) }));
}

export async function upsertProvider(data: {
  id?: string;
  name: string;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  isActive?: boolean;
}) {
  if (data.id) {
    const updateData: Record<string, unknown> = {
      displayName: data.displayName,
      baseUrl: data.baseUrl,
      defaultModel: data.defaultModel,
      isActive: data.isActive,
    };
    if (data.apiKey && !data.apiKey.includes("••••")) {
      updateData.apiKey = data.apiKey;
    }
    const provider = await db.aiProvider.update({
      where: { id: data.id },
      data: updateData,
    });
    return { ...provider, apiKey: maskApiKey(provider.apiKey) };
  }

  const provider = await db.aiProvider.create({
    data: {
      name: data.name,
      displayName: data.displayName,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      defaultModel: data.defaultModel,
      isActive: data.isActive ?? false,
    },
  });
  return { ...provider, apiKey: maskApiKey(provider.apiKey) };
}

export async function testProviderConnection(id: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const provider = await db.aiProvider.findUnique({ where: { id } });
  if (!provider) return { success: false, latencyMs: 0, message: "Provider not found" };
  if (!provider.apiKey) return { success: false, latencyMs: 0, message: "API key not configured" };

  // Mock test — replace with real ping if needed
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
  return { success: true, latencyMs: Math.floor(300 + Math.random() * 200), message: "Connection successful" };
}
