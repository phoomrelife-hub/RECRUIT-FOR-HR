/**
 * Parse address string → { province, district }
 * - กรุงเทพ: province = "กรุงเทพมหานคร", district = เขต XXX
 * - ต่างจังหวัด: province = จังหวัด XXX, district = null
 */

const BKK_ALIASES = ["กรุงเทพ", "กทม", "กทม.", "bangkok", "บางกอก", "กรุงเทพมหานคร"];

// ชื่อจังหวัดทั้งหมด (77 จังหวัด)
export const PROVINCES = [
  "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น",
  "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ",
  "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด",
  "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา",
  "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน",
  "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี",
  "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง",
  "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่",
  "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร",
  "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี",
  "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ",
  "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม",
  "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย",
  "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู",
  "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี",
  "อุบลราชธานี",
];

export type ParsedLocation = {
  province: string;      // "กรุงเทพมหานคร" | "เชียงใหม่" | ...
  district: string | null; // เขต (กทม only) | null
  label: string;         // สำหรับแสดงใน UI
};

export function parseLocation(address: string | null | undefined): ParsedLocation | null {
  if (!address) return null;
  const text = address.toLowerCase().trim();

  // Check กรุงเทพ
  const isBkk = BKK_ALIASES.some((alias) => text.includes(alias.toLowerCase()));
  if (isBkk) {
    // Extract เขต — จับ non-whitespace word หลัง "เขต"
    const districtMatch = address.match(/เขต\s*(\S+)/);
    const rawDistrict = districtMatch ? districtMatch[1].trim() : null;
    // กรอง keyword ที่ไม่ใช่ชื่อเขต (เช่น "แขวง..." หรือ "กรุงเทพ...")
    const SKIP = ["แขวง", "จังหวัด", "กรุงเทพ", "มหานคร"];
    const district = rawDistrict && !SKIP.some((s) => rawDistrict.startsWith(s))
      ? rawDistrict
      : null;
    return {
      province: "กรุงเทพมหานคร",
      district,
      label: district ? `เขต${district}` : "กรุงเทพ (ไม่ระบุเขต)",
    };
  }

  // Check ต่างจังหวัด
  for (const prov of PROVINCES) {
    if (address.includes(prov) || text.includes(prov.toLowerCase())) {
      return {
        province: prov,
        district: null,
        label: prov,
      };
    }
  }

  return null;
}

/** จัดกลุ่ม options สำหรับ dropdown */
export type LocationGroup = {
  group: string;
  options: { value: string; label: string }[];
};

export function buildLocationOptions(
  candidates: { address?: string | null }[]
): LocationGroup[] {
  const bkkDistricts = new Set<string>();
  const provinces = new Set<string>();

  for (const c of candidates) {
    const loc = parseLocation(c.address);
    if (!loc) continue;
    if (loc.province === "กรุงเทพมหานคร") {
      if (loc.district) bkkDistricts.add(loc.district);
      else bkkDistricts.add("__bkk_no_district__");
    } else {
      provinces.add(loc.province);
    }
  }

  const groups: LocationGroup[] = [];

  if (bkkDistricts.size > 0) {
    groups.push({
      group: "กรุงเทพมหานคร",
      options: [
        ...([...bkkDistricts]
          .filter((d) => d !== "__bkk_no_district__")
          .sort()
          .map((d) => ({ value: `bkk:${d}`, label: `เขต${d}` }))),
        ...(bkkDistricts.has("__bkk_no_district__")
          ? [{ value: "bkk:__all__", label: "กรุงเทพฯ (ไม่ระบุเขต)" }]
          : []),
      ],
    });
  }

  if (provinces.size > 0) {
    groups.push({
      group: "ต่างจังหวัด",
      options: [...provinces].sort().map((p) => ({ value: `province:${p}`, label: p })),
    });
  }

  return groups;
}

/** ตรวจว่า candidate ตรงกับ location filter มั้ย */
export function matchesLocationFilter(
  address: string | null | undefined,
  filterValue: string
): boolean {
  if (!filterValue) return true;
  const loc = parseLocation(address);
  if (!loc) return false;

  if (filterValue.startsWith("bkk:")) {
    if (loc.province !== "กรุงเทพมหานคร") return false;
    const district = filterValue.slice(4);
    if (district === "__all__") return loc.district === null; // เฉพาะคนไม่ระบุเขต
    return loc.district === district;
  }

  if (filterValue.startsWith("province:")) {
    return loc.province === filterValue.slice(9);
  }

  return false;
}
