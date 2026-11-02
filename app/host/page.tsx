import { redirect } from "next/navigation";

/** The admin page moved to /admin. */
export default function OldHostPage() {
  redirect("/admin");
}
