import { Header } from "@/components/Header";
import { VerifyLogin } from "@/components/HostPanel";
import { totpRequired } from "@/lib/host-auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false, follow: false } };

export default function VerifyPage() {
  return (
    <div className="checkout-page">
      <Header sections={false} />
      <main className="checkout host" id="top">
        <div className="success-card">
          <h1>Admin sign-in</h1>
          <VerifyLogin needsCode={totpRequired()} />
        </div>
      </main>
    </div>
  );
}
