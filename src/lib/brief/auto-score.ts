import { db } from "@/lib/db";
import { AiNotConfiguredError, resolveAiConfig } from "./ai";
import { scoreForBrief } from "./run";
import { notifyPending } from "./notify";

/**
 * Score one arriving candidate against their position's active brief the
 * moment they land in WAITING_HR_REVIEW — instead of HR having to run a
 * manual sweep over the backlog. Called from `after()` in the intake
 * webhooks (form + jobbkk email) so it never delays the webhook response.
 *
 * `scoreForBrief` is itself cache-keyed on (candidateId, briefId, briefHash),
 * so a retried webhook delivery costs nothing on the second call — no extra
 * idempotency guard needed here.
 *
 * Silent no-op when there's nothing to score against (no interested
 * position, no active brief for it) or AI isn't configured. Candidate intake
 * must keep working even when scoring can't.
 */
export async function scoreOnArrival(candidateId: string): Promise<void> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { interestedPositionId: true },
  });
  if (!candidate?.interestedPositionId) return;

  const brief = await db.hiringBrief.findFirst({
    where: { jobPositionId: candidate.interestedPositionId, isActive: true },
  });
  if (!brief) return;

  try {
    const config = await resolveAiConfig();
    await scoreForBrief(candidateId, brief, config);
    // Instant-tier only: this fires per arriving candidate, so the digest
    // half of notifyPending stays on its own cron schedule rather than
    // re-notifying the whole backlog on every webhook hit.
    await notifyPending(true);
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return;
    console.error("[brief] auto-score on arrival failed", candidateId, e);
  }
}
