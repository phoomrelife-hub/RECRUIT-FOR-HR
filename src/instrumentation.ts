export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron")

    // 07:00 Bangkok daily = 00:00 UTC
    cron.default.schedule("0 0 * * *", async () => {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
      const secret = process.env.CRON_SECRET ?? ""
      try {
        const res = await fetch(`${baseUrl}/api/cron/interview-reminders`, {
          headers: { Authorization: `Bearer ${secret}` },
        })
        const data = await res.json()
        console.log("[cron] interview-reminders:", data)
      } catch (err) {
        console.error("[cron] interview-reminders failed:", err)
      }
    })

    console.log("[cron] interview-reminders scheduled (00:00 UTC = 07:00 BKK)")
  }
}
