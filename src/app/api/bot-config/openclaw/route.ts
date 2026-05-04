import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { testOpenClawConnection, getOpenClawModels } from "@/lib/openclaw-ai";

// GET /api/bot-config/openclaw - ดึง OpenClaw config
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (!["SUPER_ADMIN", "HR_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await db.setting.findMany({
      where: { key: { startsWith: "bot." } },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      config[s.key.replace("bot.", "")] = s.value;
    }

    // Test connection
    const connectionStatus = await testOpenClawConnection();
    const availableModels = await getOpenClawModels();

    return NextResponse.json({
      config: {
        enabled: config.enabled !== "false",
        model: config.model || "default",
        temperature: config.temperature ? parseFloat(config.temperature) : 0.7,
        max_tokens: config.max_tokens ? parseInt(config.max_tokens) : 500,
        system_prompt: config.system_prompt || "",
      },
      connection: connectionStatus,
      availableModels,
    });
  } catch (error) {
    console.error("Error fetching OpenClaw config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// PUT /api/bot-config/openclaw - อัปเดต OpenClaw config
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (!["SUPER_ADMIN", "HR_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { enabled, model, temperature, max_tokens, system_prompt } = body;

    // Upsert settings
    const settingsToUpdate = [
      { key: "bot.enabled", value: enabled === false ? "false" : "true" },
      { key: "bot.model", value: model || "default" },
      { key: "bot.temperature", value: temperature?.toString() || "0.7" },
      { key: "bot.max_tokens", value: max_tokens?.toString() || "500" },
      { key: "bot.system_prompt", value: system_prompt || "" },
    ];

    for (const setting of settingsToUpdate) {
      await db.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating OpenClaw config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
