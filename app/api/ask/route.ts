import { saveQuestion } from "@/lib/questions";
import { isPropertyId, type PropertyId } from "@/lib/properties";
import { sendEmail } from "@/lib/email";
import { HOUSE_NAMES, adminMessage } from "@/lib/email-templates";
import { guard } from "@/lib/security";
import { notifyEmails } from "@/lib/site-config";
import { NextResponse } from "next/server";

type Payload = {
  property?: string;
  name?: string;
  email?: string;
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const blocked = guard(request, "ask", [[5, 10 * 60_000], [20, 24 * 3600_000]]);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) {
    return NextResponse.json({ error: "The question could not be read." }, { status: 400 });
  }

  const property: PropertyId = isPropertyId(body.property) ? body.property : "kaja";
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const message = (body.message ?? "").trim().slice(0, 2000);

  if (name.length < 2) {
    return NextResponse.json({ error: "Add your name." }, { status: 400 });
  }
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Add a valid email so the host can reply." }, { status: 400 });
  }
  if (message.length < 8) {
    return NextResponse.json({ error: "Write the question you want answered." }, { status: 400 });
  }

  const id = `Q-${Date.now().toString(36).toUpperCase()}`;
  const saved = await saveQuestion({ id, property, name, email, message, createdAt: new Date().toISOString() }).then(
    () => true,
    () => false,
  );
  const sent = await sendEmail({
    to: notifyEmails(),
    replyTo: email,
    ...adminMessage("question", { house: HOUSE_NAMES[property], name, email, question: message, reference: id }),
  });
  if (!sent.sent && !saved) {
    return NextResponse.json(
      { error: "The question could not be sent right now. Please try again in a few minutes." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
