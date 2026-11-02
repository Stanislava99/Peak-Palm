import { NextResponse } from "next/server";

/** Moved to /api/admin/*. */
export function POST() {
  return NextResponse.json({ error: "This address moved. Reload the admin page at /admin." }, { status: 410 });
}
