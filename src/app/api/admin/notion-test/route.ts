import { NextResponse } from "next/server";

// Temporary debug endpoint — remove after confirming NOTION_TOKEN is correct in Vercel
export async function GET() {
  const token = process.env.NOTION_TOKEN ?? "";
  const tokenInfo = token
    ? `set (length=${token.length}, prefix=${token.substring(0, 8)}...)`
    : "NOT SET";

  let notionStatus: number | string = "not tested";
  if (token) {
    try {
      const res = await fetch("https://api.notion.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      });
      notionStatus = res.status;
    } catch (e) {
      notionStatus = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({ tokenInfo, notionStatus });
}
