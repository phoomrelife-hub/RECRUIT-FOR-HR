import type { WorkPreference } from "@prisma/client";
import type { ExtractedFacts, FilterOutcome, HardFilters } from "./types";
import { EQUIPMENT_LABEL, meetsEquipment, type EquipmentToken } from "./equipment";

/**
 * Apply HR's hard requirements to what we actually know about a candidate.
 *
 * THE RULE THAT MATTERS: only a POSITIVE CONTRADICTION rejects. A fact we do
 * not know (null) always passes.
 *
 * This is not leniency, it is arithmetic. Of 5,959 candidates, `age` is filled
 * on 19 and `expectedSalary` on 18. Treating "unknown" as "fails the filter"
 * would reject 99.7% of the database on day one and the feature would look
 * broken while behaving exactly as written. An unknown lowers a candidate's
 * star rating naturally, via coverage — it must not delete them.
 *
 * Runs in code rather than in the prompt because these are checkable facts. A
 * model asked to verify a number it cannot see invents a shortfall instead.
 */

/**
 * Can someone with `have` work a role advertised as `want`?
 * HYBRID satisfies either pole; the poles do not satisfy each other.
 */
function workPreferenceFits(want: WorkPreference, have: WorkPreference): boolean {
  if (want === have) return true;
  if (have === "HYBRID") return true;
  if (want === "HYBRID") return true;
  return false;
}

const WORK_LABEL: Record<WorkPreference, string> = {
  ONSITE: "เข้าออฟฟิศ (inhouse)",
  WFH: "ทำงานที่บ้าน (WFH)",
  HYBRID: "ผสม (hybrid)",
};

export function applyHardFilters(filters: HardFilters, facts: ExtractedFacts): FilterOutcome {
  const pass: FilterOutcome = { passed: true, reason: null };
  const reject = (reason: string): FilterOutcome => ({ passed: false, reason });

  if (filters.minAge !== null && facts.age !== null && facts.age < filters.minAge) {
    return reject(`อายุ ${facts.age} ปี ต่ำกว่าเกณฑ์ ${filters.minAge} ปี`);
  }
  if (filters.maxAge !== null && facts.age !== null && facts.age > filters.maxAge) {
    return reject(`อายุ ${facts.age} ปี เกินเกณฑ์ ${filters.maxAge} ปี`);
  }

  // Salary reads as the candidate's ASK against the range HR will pay. Someone
  // asking below the floor is not rejected — that is a bargain, not a mismatch.
  if (
    filters.maxSalary !== null &&
    facts.expectedSalary !== null &&
    facts.expectedSalary > filters.maxSalary
  ) {
    return reject(
      `ขอเงินเดือน ${facts.expectedSalary.toLocaleString()} เกินงบ ${filters.maxSalary.toLocaleString()}`,
    );
  }
  // minSalary exists for roles where an unusually low ask signals a mismatch in
  // seniority. Off by default; only applied when HR sets it.
  if (
    filters.minSalary !== null &&
    facts.expectedSalary !== null &&
    facts.expectedSalary < filters.minSalary
  ) {
    return reject(
      `ขอเงินเดือน ${facts.expectedSalary.toLocaleString()} ต่ำกว่าช่วงที่กำหนด ${filters.minSalary.toLocaleString()}`,
    );
  }

  if (
    filters.workPreference !== null &&
    facts.workPreference !== null &&
    !workPreferenceFits(filters.workPreference, facts.workPreference)
  ) {
    return reject(
      `ต้องการ ${WORK_LABEL[filters.workPreference]} แต่ผู้สมัครระบุ ${WORK_LABEL[facts.workPreference]}`,
    );
  }

  if (
    filters.minExperienceYears !== null &&
    facts.experienceYears !== null &&
    facts.experienceYears < filters.minExperienceYears
  ) {
    return reject(
      `ประสบการณ์ ${facts.experienceYears} ปี ต่ำกว่าเกณฑ์ ${filters.minExperienceYears} ปี`,
    );
  }

  if (
    filters.minSalesAmount !== null &&
    facts.maxSalesAmount !== null &&
    facts.maxSalesAmount < filters.minSalesAmount
  ) {
    return reject(
      `ยอดขายสูงสุด ${facts.maxSalesAmount.toLocaleString()} ต่ำกว่าเกณฑ์ ${filters.minSalesAmount.toLocaleString()}`,
    );
  }

  const equip = meetsEquipment(filters.requiredEquipment, facts.equipment);
  if (!equip.passed) {
    return reject(
      `ไม่มีอุปกรณ์ที่ต้องการ: ${equip.missing
        .map((m) => EQUIPMENT_LABEL[m as EquipmentToken] ?? m)
        .join(", ")}`,
    );
  }

  return pass;
}
