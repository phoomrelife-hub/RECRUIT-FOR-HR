export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron")

    const baseUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000"

    async function hit(path: string, label: string) {
      const secret = process.env.CRON_SECRET ?? ""
      try {
        const res = await fetch(`${baseUrl()}${path}`, {
          headers: { Authorization: `Bearer ${secret}` },
        })
        const data = await res.json()
        console.log(`[cron] ${label}:`, data)
      } catch (err) {
        console.error(`[cron] ${label} failed:`, err)
      }
    }

    // 07:00 Bangkok daily = 00:00 UTC
    cron.default.schedule("0 0 * * *", () => hit("/api/cron/interview-reminders", "interview-reminders"))

    // 09:00 Bangkok daily = 02:00 UTC — the roll-up of yesterday's matches that
    // scored below each brief's instant threshold. Five-star finds have already
    // been sent one at a time, so this is deliberately a start-of-day summary
    // rather than an interruption.
    //
    // NOTE: this scheduler runs IN-PROCESS, so it fires once per running
    // instance. `notifiedAt` keeps repeats harmless, but if this app is ever
    // scaled past one instance the digest should move to an external trigger.
    cron.default.schedule("0 2 * * *", () => hit("/api/cron/brief-digest", "brief-digest"))

    console.log("[cron] interview-reminders (00:00 UTC) + brief-digest (02:00 UTC) scheduled")
  }
}
