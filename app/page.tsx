import { HouseGate } from "@/components/HouseGate";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Winter and summer · Villa Kaja and Jani’s Beach House",
  description:
    "Two houses, one host. Villa Kaja is a private chalet in Bansko for the winter. Jani’s Beach House sits by the sand in Neoi Epivates for the summer.",
};

export default function HomePage() {
  return <HouseGate />;
}
