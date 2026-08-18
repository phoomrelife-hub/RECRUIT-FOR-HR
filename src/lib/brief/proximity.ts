/**
 * How far a candidate lives from the office, judged from a free-text Thai address.
 *
 * OFFICE: บริษัท รีไลฟ์ โซลูชั่นส์ จำกัด — PLATINUM PLACE, 76/4 ซอยรามคำแหง 178,
 * เขตมีนบุรี กรุงเทพมหานคร 10510.
 *
 * This matters more than it looks. Every open position is now onsite in Min Buri
 * (SOUL.md กฎ 8, changed 22 มิ.ย. 2569), and Min Buri is far-eastern Bangkok — a
 * candidate in ปทุมธานี or ธนบุรี is looking at a 90-minute commute each way, and
 * a sample of real applicant addresses turned up เชียงใหม่, ปัตตานี, พิษณุโลก and
 * สุรินทร์. Distance is one of the strongest predictors of whether someone will
 * actually take, and keep, the job.
 *
 * GEOGRAPHY, researched 2026-08-18 rather than assumed:
 *
 *  - Adjacent districts (th.wikipedia "เขตมีนบุรี"): คลองสามวา (N), หนองจอก (E),
 *    ลาดกระบัง (S), สะพานสูง and คันนายาว (W).
 *  - MRT Pink Line is OPEN (7 Jan 2024) and TERMINATES at มีนบุรี, running
 *    แคราย–มีนบุรี via เมืองนนทบุรี, ปากเกร็ด, หลักสี่, บางเขน, คันนายาว. It puts
 *    an otherwise-impossible corridor within reach, but end to end is 36km and
 *    ~1 hour, so it is a "workable" not a "close" signal.
 *  - MRT Orange Line east (ศูนย์วัฒนธรรม–มีนบุรี) is NOT open. Civil works are
 *    done but service is targeted for 2570. It must NOT be counted as a commute
 *    option, which is the easy mistake here: the stations exist and are on maps.
 *
 * Deliberately a coarse tier, not a distance. Addresses are free text of wildly
 * varying precision ("กรุงเทพมหานคร" vs a full house number), so a kilometre
 * figure would be false precision. HR wants "ใกล้ไหม", not 14.7km.
 */

export type ProximityTier =
  | "adjacent" // Min Buri itself or a district touching it
  | "nearby" // eastern/north-eastern Bangkok, a realistic daily commute
  | "bangkok" // elsewhere in Bangkok — long, but people do it
  | "commutable_province" // provinces bordering the eastern side, or on the Pink Line
  | "far" // anywhere else in Thailand
  | "unknown"; // no address on file

export interface ProximityResult {
  tier: ProximityTier;
  /** What matched, so HR can see why — never just a bare verdict. */
  matched: string | null;
  /** Thai, shown in the UI. */
  label: string;
}

/** Min Buri itself plus every district that touches it. */
const ADJACENT = ["มีนบุรี", "คลองสามวา", "หนองจอก", "ลาดกระบัง", "สะพานสูง", "คันนายาว"];

/**
 * Eastern / north-eastern Bangkok — one bus or a short drive.
 * บางเขน and หลักสี่ are here because the Pink Line reaches them directly.
 */
const NEARBY = [
  "บึงกุ่ม",
  "บางกะปิ",
  "ประเวศ",
  "สวนหลวง",
  "วังทองหลาง",
  "ลาดพร้าว",
  "สายไหม",
  "บางเขน",
  "หลักสี่",
  "จตุจักร",
  "ดอนเมือง",
  "รามอินทรา",
  "นวมินทร์",
  "รามคำแหง",
  "สุวินทวงศ์",
  "ร่มเกล้า",
  "เสรีไทย",
];

/**
 * Provinces reachable daily: they border Bangkok's eastern flank, or sit on the
 * Pink Line, which ends at our doorstep.
 */
const COMMUTABLE_PROVINCE = [
  "ฉะเชิงเทรา", // borders หนองจอก / ลาดกระบัง
  "ปทุมธานี", // ลำลูกกา borders คลองสามวา
  "สมุทรปราการ", // borders ลาดกระบัง / ประเวศ
  "นนทบุรี", // Pink Line western terminus
];

/** Every Thai province except Bangkok, used to detect "definitely not local". */
const PROVINCES = [
  "กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี",
  "ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม",
  "นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ",
  "บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา",
  "พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม",
  "มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี",
  "ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม",
  "สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์",
  "หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี",
];

/**
 * Bangkok by landmark rather than by district.
 *
 * A real chunk of stored addresses name only a condo or a road
 * ("Icondo green space sukhumvit77", "ลุมพินีเพชรเกษม 98", "พระราม 8"). These are
 * unmistakably Bangkok to a human and were coming back "unknown".
 */
const BANGKOK = [
  "กรุงเทพ",
  "กทม",
  "bangkok",
  "สุขุมวิท",
  "sukhumvit",
  "เพชรเกษม",
  "รัชดา",
  "รัขดา", // seen in the data
  "พระราม",
  "บางนา",
  "ลาซาล",
  "ประชาสงเคราะห์",
  "ลาดพร้าว",
  "อ่อนนุช",
  "พหลโยธิน",
  "วิภาวดี",
  "แจ้งวัฒนะ",
  "ศรีนครินทร์",
];

/**
 * Short forms and misspellings that appear in the real data.
 *
 * People abbreviate ("จ.อุดร", "นครศรี") and mistype ("ปธุมธานี",
 * "กาญจรบุรี", "พระนครศรีอยูธย"). Each of these was an actual "unknown" in the
 * candidates table, and each one silently threw away a usable location signal.
 */
const PROVINCE_ALIASES: Array<[string, string]> = [
  ["อยุธยา", "พระนครศรีอยุธยา"],
  ["อยูธย", "พระนครศรีอยุธยา"],
  ["อุดร", "อุดรธานี"],
  ["นครศรี", "นครศรีธรรมราช"],
  ["นครราค", "นครราชสีมา"],
  ["โคราช", "นครราชสีมา"],
  ["ปธุมธานี", "ปทุมธานี"],
  ["ปทุม", "ปทุมธานี"],
  ["กาญจรบุรี", "กาญจนบุรี"],
  ["อุบล", "อุบลราชธานี"],
  ["สุราษฎร", "สุราษฎร์ธานี"],
  ["ศรีสะเกด", "ศรีสะเกษ"],
  ["ขอนเเก่น", "ขอนแก่น"],
];

/**
 * Postal codes, the most reliable signal in a messy address.
 *
 * Bangkok is 10xxx; นนทบุรี 11xxx; ปทุมธานี 12xxx; ฉะเชิงเทรา 24xxx. Anything
 * else is upcountry. These five 10xxx codes cover the office's own district and
 * its neighbours.
 */
const ADJACENT_POSTAL = new Set(["10510", "10520", "10530", "10230", "10240"]);

const LABEL: Record<ProximityTier, string> = {
  adjacent: "ใกล้ออฟฟิศมาก",
  nearby: "เดินทางสะดวก",
  bangkok: "อยู่ในกรุงเทพ",
  commutable_province: "ปริมณฑล เดินทางได้",
  far: "อยู่ต่างจังหวัด",
  unknown: "ไม่ระบุที่อยู่",
};

/** Normalise for matching: drop spaces and administrative prefixes. */
function norm(s: string): string {
  return (
    s
      // "เเ" (two sara e) is the single most common Thai typo for "แ" and is
      // invisible when read — it turned "กำแพงเพชร" into an unknown.
      .replace(/เเ/g, "แ")
      .replace(/\s+/g, "")
      .replace(/(เขต|แขวง|อำเภอ|อ\.|ตำบล|ต\.|จังหวัด|จ\.)/g, "")
      .toLowerCase()
  );
}

/** First 5-digit run that looks like a Thai postal code. */
function postalCode(s: string): string | null {
  const m = s.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/**
 * Classify by postal code alone.
 *
 * The most reliable field in a messy address, and the only one that survives
 * every abbreviation and typo. Returns null when the code tells us nothing.
 */
function fromPostal(code: string): ProximityTier | null {
  if (ADJACENT_POSTAL.has(code)) return "adjacent";
  if (code.startsWith("10")) return "bangkok"; // Bangkok, and สมุทรปราการ's 102xx
  if (code.startsWith("11") || code.startsWith("12")) return "commutable_province"; // นนทบุรี, ปทุมธานี
  if (code.startsWith("24")) return "commutable_province"; // ฉะเชิงเทรา
  if (/^\d{5}$/.test(code)) return "far";
  return null;
}

/**
 * Classify a free-text address.
 *
 * Order is load-bearing. A Bangkok district name is checked BEFORE the province
 * list because several district names collide with province names — "บางเขน"
 * and "ลาดกระบัง" are unambiguous, but an address reading
 * "แขวงมีนบุรี กรุงเทพมหานคร" must never be read as a province match. Likewise a
 * far province is checked before the generic Bangkok token, because plenty of
 * upcountry addresses mention Bangkok in passing (e.g. a former workplace).
 */
export function classifyProximity(address: string | null | undefined): ProximityResult {
  if (!address || !address.trim()) {
    return { tier: "unknown", matched: null, label: LABEL.unknown };
  }
  const a = norm(address);
  const hit = (tier: ProximityTier, matched: string): ProximityResult => ({
    tier,
    matched,
    label: LABEL[tier],
  });

  for (const d of ADJACENT) if (a.includes(norm(d))) return hit("adjacent", d);
  for (const d of NEARBY) if (a.includes(norm(d))) return hit("nearby", d);

  // Aliases before the canonical list: "อยุธยา" must resolve to
  // พระนครศรีอยุธยา, which the canonical spelling would never match.
  for (const [alias, canonical] of PROVINCE_ALIASES) {
    if (!a.includes(norm(alias))) continue;
    return COMMUTABLE_PROVINCE.includes(canonical)
      ? hit("commutable_province", canonical)
      : hit("far", canonical);
  }

  for (const p of COMMUTABLE_PROVINCE) {
    if (a.includes(norm(p))) return hit("commutable_province", p);
  }
  for (const p of PROVINCES) if (a.includes(norm(p))) return hit("far", p);

  // Postal code outranks a bare landmark: "144 ต.โค้งไผ่ ... 62140" names no
  // province a human would recognise, but 62xxx is unambiguously upcountry.
  const code = postalCode(address);
  if (code) {
    const t = fromPostal(code);
    if (t) return hit(t, code);
  }

  for (const b of BANGKOK) if (a.includes(norm(b))) return hit("bangkok", b);

  return { tier: "unknown", matched: null, label: LABEL.unknown };
}

/** Best-first, for sorting and for "how close is close enough" filters. */
export const TIER_ORDER: ProximityTier[] = [
  "adjacent",
  "nearby",
  "bangkok",
  "commutable_province",
  "far",
  "unknown",
];

export function tierRank(t: ProximityTier): number {
  return TIER_ORDER.indexOf(t);
}

/**
 * Is this candidate close enough for HR's threshold?
 *
 * `unknown` always passes. Same rule as every other filter here: a missing
 * address is a gap in our data, not a fact about the candidate, and with only
 * 266 of 5,959 addresses on file, rejecting on unknown would delete the
 * database.
 */
export function meetsProximity(tier: ProximityTier, minimum: ProximityTier): boolean {
  if (tier === "unknown") return true;
  return tierRank(tier) <= tierRank(minimum);
}
