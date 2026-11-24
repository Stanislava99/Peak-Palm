/**
 * Ski equipment rental and ski school in Bansko, through Frosina's partner shop.
 * Guests only RESERVE here (nothing is paid on the site): the reservation goes to Frosina as a PDF
 * and the guest pays the shop / ski school in Bansko.
 *
 * Prices are the shop's 2026/27 list. Each row is [1 day, 2 days, … 6 days, each extra day after 6].
 * To update for a new season, edit the tables and SCHOOL_SEASONS below.
 */

export type PriceRow = readonly [number, number, number, number, number, number, number];

export type EquipmentGroup = "adult" | "child" | "premium";

export const EQUIPMENT_GROUPS: Record<EquipmentGroup, string> = {
  adult: "Adults",
  child: "Children (12 or under)",
  premium: "Premium equipment",
};

export const EQUIPMENT = {
  "a-spb": { group: "adult", name: "Ski + poles + boots", prices: [18, 36, 52, 67, 81, 94, 15.67] },
  "a-sp": { group: "adult", name: "Ski + poles", prices: [15, 30, 43, 55, 66, 76, 12.67] },
  "a-sbb": { group: "adult", name: "Snowboard + boots", prices: [25, 50, 73, 94, 113, 130, 21.67] },
  "a-sb": { group: "adult", name: "Snowboard", prices: [20, 40, 58, 75, 91, 106, 17.67] },
  "a-b": { group: "adult", name: "Boots", prices: [15, 30, 43, 55, 66, 76, 12.67] },
  "a-jp": { group: "adult", name: "Jacket + pants", prices: [18, 36, 52, 67, 81, 94, 15.67] },
  "a-h": { group: "adult", name: "Helmet", prices: [5, 10, 15, 20, 25, 30, 5] },
  "a-ss": { group: "adult", name: "Snowshoes", prices: [10, 20, 30, 40, 50, 60, 10] },
  "c-spb": { group: "child", name: "Ski + poles + boots", prices: [13, 26, 37, 47, 56, 64, 10.67] },
  "c-sp": { group: "child", name: "Ski + poles", prices: [10, 20, 29, 37, 44, 50, 8.33] },
  "c-sbb": { group: "child", name: "Snowboard + boots", prices: [20, 35, 52, 64, 77, 88, 14.67] },
  "c-sb": { group: "child", name: "Snowboard", prices: [13, 26, 37, 47, 56, 64, 10.67] },
  "c-b": { group: "child", name: "Boots", prices: [10, 20, 29, 37, 44, 50, 8.33] },
  "c-h": { group: "child", name: "Helmet", prices: [0, 0, 0, 0, 0, 0, 0] },
  "p-spb": { group: "premium", name: "Ski + poles + boots", prices: [28, 56, 80, 102, 122, 140, 23.33] },
  "p-s": { group: "premium", name: "Ski", prices: [20, 40, 58, 75, 91, 106, 17.67] },
  "p-sbb": { group: "premium", name: "Snowboard + boots", prices: [34, 68, 98, 126, 152, 176, 29.33] },
  "p-sb": { group: "premium", name: "Snowboard", prices: [28, 56, 80, 102, 122, 140, 23.33] },
  "p-ct": { group: "premium", name: "Cross-country telemark", prices: [28, 56, 80, 102, 122, 140, 23.33] },
  "p-st": { group: "premium", name: "Ski touring set", prices: [34, 68, 98, 126, 152, 176, 29.33] },
} as const satisfies Record<string, { group: EquipmentGroup; name: string; prices: PriceRow }>;

export type EquipmentId = keyof typeof EQUIPMENT;

export type LessonKind = "group" | "private" | "one";
export type LessonHours = 2 | 4;
export type Season = "low" | "high";

export const LESSON_KINDS: Record<LessonKind, { name: string; hint: string }> = {
  group: { name: "Group lessons", hint: "Price per person; you join a ski-school group." },
  private: { name: "Private group lessons", hint: "Your own instructor for your group. Price is for 2 people, plus each extra person per day." },
  one: { name: "One-to-one lessons", hint: "One instructor per person. Price per person." },
};

/** Ski school prices by season, kind and hours. `extra` = each additional person per day (private groups). */
export const SCHOOL: Record<Season, Record<LessonKind, Record<LessonHours, { prices: PriceRow; extra?: number }>>> = {
  low: {
    group: { 2: { prices: [50, 95, 135, 175, 215, 250, 41.67] }, 4: { prices: [95, 180, 260, 335, 405, 470, 78.33] } },
    private: {
      2: { prices: [140, 265, 385, 500, 610, 710, 118.33], extra: 40 },
      4: { prices: [265, 505, 730, 945, 1150, 1345, 224.17], extra: 55 },
    },
    one: { 2: { prices: [105, 205, 295, 380, 460, 535, 89.17] }, 4: { prices: [205, 390, 565, 730, 890, 1040, 173.33] } },
  },
  high: {
    group: { 2: { prices: [55, 105, 155, 200, 240, 280, 46.67] }, 4: { prices: [105, 200, 290, 375, 455, 530, 88.33] } },
    private: {
      2: { prices: [165, 315, 455, 590, 715, 835, 139.17], extra: 45 },
      4: { prices: [295, 560, 810, 1050, 1275, 1490, 248.33], extra: 60 },
    },
    one: { 2: { prices: [120, 230, 330, 425, 520, 610, 101.67] }, 4: { prices: [230, 435, 635, 820, 995, 1165, 194.17] } },
  },
};

/** Ski school seasons (inclusive). The season of the first lesson day sets the price. */
export const SCHOOL_SEASONS: Array<{ from: string; to: string; season: Season }> = [
  { from: "2026-12-12", to: "2026-12-22", season: "low" },
  { from: "2026-12-23", to: "2027-03-20", season: "high" },
  { from: "2027-03-21", to: "2027-04-11", season: "low" },
];

export const SEASON_LABEL: Record<Season, string> = { low: "Low season", high: "High season" };

export function seasonOf(date: string): Season | null {
  return SCHOOL_SEASONS.find((s) => date >= s.from && date <= s.to)?.season ?? null;
}

export function seasonRanges(season: Season) {
  return SCHOOL_SEASONS.filter((s) => s.season === season);
}

export const MAX_DAYS = 21;
export const MAX_PEOPLE = 15;
export const MAX_LINES = 12;

/** Price for `days` days from a row: the 1–6 day price, then the extra-day price for each day after 6. */
export function rowPrice(row: PriceRow, days: number) {
  if (days <= 6) return row[days - 1];
  return round2(row[5] + row[6] * (days - 6));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type EquipmentLine = { type: "equipment"; item: EquipmentId; people: number; from: string; days: number };
export type LessonLine = { type: "lesson"; kind: LessonKind; hours: LessonHours; people: number; from: string; days: number };
export type RentalLine = EquipmentLine | LessonLine;

export type PricedLine = RentalLine & {
  title: string;
  detail: string;
  /** null: the ski school price for that date isn't published yet (outside the seasons above). */
  price: number | null;
};

export function priceLine(line: RentalLine): PricedLine {
  const dayWord = `${line.days} day${line.days === 1 ? "" : "s"}`;
  if (line.type === "equipment") {
    const item = EQUIPMENT[line.item];
    return {
      ...line,
      title: `${item.name} (${line.item.startsWith("c-") ? "child" : line.item.startsWith("p-") ? "premium" : "adult"})`,
      detail: `${line.people} × ${dayWord}`,
      price: round2(rowPrice(item.prices, line.days) * line.people),
    };
  }
  const season = seasonOf(line.from);
  const kind = LESSON_KINDS[line.kind];
  const title = `${kind.name.replace(" lessons", "")} ski school, ${line.hours} h a day`;
  const people = `${line.people} ${line.people === 1 ? "person" : "people"}`;
  if (!season) return { ...line, title, detail: `${people} × ${dayWord} · price on request`, price: null };
  const rate = SCHOOL[season][line.kind][line.hours];
  const base = rowPrice(rate.prices, line.days);
  const price =
    line.kind === "private"
      ? base + (rate.extra ?? 0) * Math.max(0, line.people - 2) * line.days
      : base * line.people;
  return { ...line, title, detail: `${people} × ${dayWord} · ${SEASON_LABEL[season].toLowerCase()}`, price: round2(price) };
}

export function priceLines(lines: RentalLine[]) {
  const priced = lines.map(priceLine);
  const total = round2(priced.reduce((sum, l) => sum + (l.price ?? 0), 0));
  return { lines: priced, total, someOnRequest: priced.some((l) => l.price === null) };
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Validates lines sent by the browser. Returns null if any line is wrong. */
export function parseLines(input: unknown): RentalLine[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_LINES) return null;
  const out: RentalLine[] = [];
  for (const raw of input as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== "object") return null;
    const days = int(raw.days, 1, MAX_DAYS);
    const from = typeof raw.from === "string" && datePattern.test(raw.from) ? raw.from : null;
    if (!days || !from) return null;
    if (raw.type === "equipment") {
      const people = int(raw.people, 1, MAX_PEOPLE);
      if (!people || typeof raw.item !== "string" || !(raw.item in EQUIPMENT)) return null;
      out.push({ type: "equipment", item: raw.item as EquipmentId, people, from, days });
    } else if (raw.type === "lesson") {
      const kind = raw.kind as LessonKind;
      if (!(kind in LESSON_KINDS)) return null;
      const hours = raw.hours === 2 || raw.hours === 4 ? raw.hours : null;
      const people = int(raw.people, kind === "private" ? 2 : 1, MAX_PEOPLE);
      if (!hours || !people) return null;
      out.push({ type: "lesson", kind, hours, people, from, days });
    } else return null;
  }
  return out;
}

/**
 * Compact text for Stripe metadata (500 characters a value), e.g.
 * "E.a-spb.2.20261224.5|L.private.4.3.20261224.5".
 */
export function encodeLines(lines: RentalLine[]): string {
  return lines
    .map((l) =>
      l.type === "equipment"
        ? `E.${l.item}.${l.people}.${l.from.replace(/-/g, "")}.${l.days}`
        : `L.${l.kind}.${l.hours}.${l.people}.${l.from.replace(/-/g, "")}.${l.days}`,
    )
    .join("|");
}

export function decodeLines(text: string | undefined | null): RentalLine[] {
  if (!text) return [];
  const date = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const raw = text.split("|").map((part) => {
    const f = part.split(".");
    if (f[0] === "E") return { type: "equipment", item: f[1], people: Number(f[2]), from: date(f[3] ?? ""), days: Number(f[4]) };
    return { type: "lesson", kind: f[1], hours: Number(f[2]), people: Number(f[3]), from: date(f[4] ?? ""), days: Number(f[5]) };
  });
  return parseLines(raw) ?? [];
}
