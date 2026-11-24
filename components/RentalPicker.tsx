"use client";

import { formatMoney } from "@/lib/pricing";
import {
  EQUIPMENT,
  EQUIPMENT_GROUPS,
  LESSON_KINDS,
  MAX_DAYS,
  MAX_LINES,
  MAX_PEOPLE,
  priceLine,
  priceLines,
  type EquipmentGroup,
  type EquipmentId,
  type LessonKind,
  type RentalLine,
} from "@/lib/rentals";

const GROUP_ITEMS = (group: EquipmentGroup) =>
  (Object.entries(EQUIPMENT) as Array<[EquipmentId, (typeof EQUIPMENT)[EquipmentId]]>).filter(([, item]) => item.group === group);

function groupOf(id: EquipmentId): EquipmentGroup {
  return EQUIPMENT[id].group;
}

/** Rows of ski equipment and ski school lessons, with the shop's price for each and the total. */
export function RentalPicker({
  lines,
  onChange,
  defaultFrom,
  defaultDays,
  defaultPeople,
  minDate,
}: {
  lines: RentalLine[];
  onChange: (lines: RentalLine[]) => void;
  defaultFrom: string;
  defaultDays: number;
  defaultPeople: number;
  minDate?: string;
}) {
  const days = Math.max(1, Math.min(MAX_DAYS, defaultDays || 1));
  const people = Math.max(1, Math.min(MAX_PEOPLE, defaultPeople || 1));
  const set = (i: number, next: RentalLine) => onChange(lines.map((l, j) => (j === i ? next : l)));
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i));
  const { total, someOnRequest } = priceLines(lines);
  const full = lines.length >= MAX_LINES;

  return (
    <div className="rental-picker">
      {lines.length ? (
        <ul className="rental-lines">
          {lines.map((line, i) => {
            const priced = priceLine(line);
            return (
              <li key={i} className="rental-line">
                <div className="rental-line-head">
                  <b>{line.type === "equipment" ? "Equipment" : "Ski school"}</b>
                  <button type="button" className="rental-remove" onClick={() => remove(i)} aria-label="Remove this line">
                    Remove
                  </button>
                </div>
                <div className="rental-fields">
                  {line.type === "equipment" ? (
                    <>
                      <label>
                        <span>For</span>
                        <select
                          value={groupOf(line.item)}
                          onChange={(e) => {
                            const group = e.target.value as EquipmentGroup;
                            set(i, { ...line, item: GROUP_ITEMS(group)[0][0] });
                          }}
                        >
                          {(Object.keys(EQUIPMENT_GROUPS) as EquipmentGroup[]).map((g) => (
                            <option key={g} value={g}>
                              {EQUIPMENT_GROUPS[g]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="rental-wide">
                        <span>Item</span>
                        <select value={line.item} onChange={(e) => set(i, { ...line, item: e.target.value as EquipmentId })}>
                          {GROUP_ITEMS(groupOf(line.item)).map(([id, item]) => (
                            <option key={id} value={id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="rental-wide">
                        <span>Lessons</span>
                        <select
                          value={line.kind}
                          onChange={(e) => {
                            const kind = e.target.value as LessonKind;
                            set(i, { ...line, kind, people: kind === "private" ? Math.max(2, line.people) : line.people });
                          }}
                        >
                          {(Object.keys(LESSON_KINDS) as LessonKind[]).map((k) => (
                            <option key={k} value={k}>
                              {LESSON_KINDS[k].name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Hours a day</span>
                        <select value={line.hours} onChange={(e) => set(i, { ...line, hours: Number(e.target.value) as 2 | 4 })}>
                          <option value={2}>2 hours</option>
                          <option value={4}>4 hours</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    <span>People</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={line.type === "lesson" && line.kind === "private" ? 2 : 1}
                      max={MAX_PEOPLE}
                      value={line.people}
                      onChange={(e) => set(i, { ...line, people: clamp(e.target.value, line.type === "lesson" && line.kind === "private" ? 2 : 1, MAX_PEOPLE) })}
                    />
                  </label>
                  <label>
                    <span>From</span>
                    <input type="date" value={line.from} min={minDate} onChange={(e) => e.target.value && set(i, { ...line, from: e.target.value })} required />
                  </label>
                  <label>
                    <span>Days</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_DAYS}
                      value={line.days}
                      onChange={(e) => set(i, { ...line, days: clamp(e.target.value, 1, MAX_DAYS) })}
                    />
                  </label>
                </div>
                <p className="rental-line-price">
                  <span>
                    {line.type === "lesson" ? LESSON_KINDS[line.kind].hint + " " : ""}
                    {priced.detail}
                  </span>
                  <b>{priced.price === null ? "Price on request" : priced.price === 0 ? "Free" : formatMoney(priced.price)}</b>
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rental-add">
        <button
          type="button"
          className="button ghost"
          disabled={full}
          onClick={() => onChange([...lines, { type: "equipment", item: "a-spb", people, from: defaultFrom, days }])}
        >
          + Ski or snowboard equipment
        </button>
        <button
          type="button"
          className="button ghost"
          disabled={full}
          onClick={() => onChange([...lines, { type: "lesson", kind: "group", hours: 2, people: Math.min(people, 4), from: defaultFrom, days: Math.min(days, 6) }])}
        >
          + Ski school lessons
        </button>
      </div>

      {lines.length ? (
        <p className="rental-total">
          <span>
            Estimated price at the shop
            <small>
              <b>Reservation only: you pay nothing now.</b> You pay the shop or ski school in Bansko.
              {someOnRequest ? " Lessons outside the published season dates are priced on request." : ""}
            </small>
          </span>
          <strong>{formatMoney(total)}</strong>
        </p>
      ) : null}
    </div>
  );
}

function clamp(value: string, min: number, max: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

