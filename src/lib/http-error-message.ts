/**
 * Maps an HTTP response's status + server `error` field to a Thai message safe
 * to show in a toast. Every pre-existing API route in this repo returns raw
 * English strings ("Forbidden", "Unauthorized") — that's not changing here,
 * it would create a two-dialect API. This maps at the display boundary instead.
 *
 * 400 / 422 / 429 keep the server's own `error` field — this feature already
 * returns Thai messages for those deliberately (e.g. NoRubricError,
 * CostLimitExceededError).
 */
export function httpErrorMessage(status: number, serverError?: string): string {
  if (status === 401) return "กรุณาเข้าสู่ระบบใหม่";
  if (status === 403) return "ไม่มีสิทธิ์ใช้งานส่วนนี้";
  if (status >= 500) return "ระบบขัดข้อง ลองใหม่อีกครั้ง";
  return serverError || "เกิดข้อผิดพลาด";
}
