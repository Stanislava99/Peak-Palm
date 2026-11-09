export type CalendarDay = {
  date: string;
  available: boolean;
  checkin: boolean;
  checkout: boolean;
  minNights: number;
  maxNights: number;
};

export type StayVerdict = {
  ok: boolean;
  nights: number;
  message: string;
};

export function nightsBetween(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function eachNight(checkIn: string, checkOut: string) {
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  while (cursor.getTime() < end) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatLong(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Today's date at the houses (Bulgaria and Greece share a time zone). */
export function todayAtHouses(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function evaluateStay(days: CalendarDay[], checkIn: string, checkOut: string): StayVerdict {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const start = byDate.get(checkIn);
  const end = byDate.get(checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  if (!start || !end || nights <= 0) {
    return { ok: false, nights, message: "Choose a check-in and a later check-out." };
  }
  if (checkIn < todayAtHouses()) {
    return { ok: false, nights, message: "Check-in can’t be in the past." };
  }
  if (!start.checkin) {
    return { ok: false, nights, message: "Check-in isn’t possible on that date." };
  }
  if (!end.checkout) {
    return { ok: false, nights, message: "Check-out isn’t possible on that date." };
  }
  if (nights < start.minNights) {
    return {
      ok: false,
      nights,
      message: `Stays from ${formatDay(checkIn)} need at least ${start.minNights} nights.`,
    };
  }
  if (nights > start.maxNights) {
    return {
      ok: false,
      nights,
      message: `Stays from this date can be up to ${start.maxNights} nights.`,
    };
  }
  const blocked = eachNight(checkIn, checkOut).filter((date) => !byDate.get(date)?.available);
  if (blocked.length) {
    return {
      ok: false,
      nights,
      message: `Already booked: ${blocked
        .slice(0, 3)
        .map(formatDay)
        .join(", ")}${blocked.length > 3 ? " and other nights" : ""}.`,
    };
  }
  return {
    ok: true,
    nights,
    message: `Free for ${nights} night${nights === 1 ? "" : "s"}.`,
  };
}

export function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    cells.push(iso);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
