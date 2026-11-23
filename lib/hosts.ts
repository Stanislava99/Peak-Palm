import type { PropertyId } from "./properties";

/**
 * The people guests deal with. Edit the bios freely.
 * Photo: put a square JPG in public/hosts/ (e.g. public/hosts/frosina.jpg) and set `photo`.
 * Without a photo, a monogram is shown.
 * Add more hosts (e.g. a co-host who hands over the keys) by adding entries.
 */
export type Host = {
  name: string;
  role: string;
  photo: string | null;
  bio: string;
  superhost: boolean;
  languages: string[];
  houses: PropertyId[];
  /** Phone in international format, e.g. "+359 88 123 4567". null hides it on the site. */
  phone: string | null;
  /** Show WhatsApp / Viber buttons for this number. */
  whatsapp: boolean;
  viber: boolean;
};

export const HOSTS: Host[] = [
  {
    name: "Frosina",
    role: "Your host · with her family",
    photo: null,
    bio: "Sea & Ski is a family business. Frosina runs both houses together with her husband Nikola, their daughter and their son: Villa Kaja in the mountains at Bansko, and Jani’s Beach House by the sea in Neoi Epivates. Book direct and you deal with the family from the first question to the keys: arrival times, extra beds, where to eat, how the sauna works.",
    superhost: true,
    languages: [],
    houses: ["kaja", "janis"],
    phone: "+389 71 210 254",
    whatsapp: true,
    viber: true,
  },
  {
    name: "Nikola",
    role: "Your host · Frosina’s husband",
    photo: null,
    bio: "Call Nikola or Frosina, whichever suits you: they both know the two houses inside out and can help with anything about your stay.",
    superhost: true,
    languages: [],
    houses: ["kaja", "janis"],
    phone: "+359 89 729 8601",
    whatsapp: true,
    viber: true,
  },
];

export function hostsFor(property: PropertyId) {
  return HOSTS.filter((host) => host.houses.includes(property));
}

/**
 * The family photo shown at the top of "Meet your host".
 * Put a landscape JPG (about 3:2, at least 1600px wide) at public/hosts/family.jpg and set `photo` to "/hosts/family.jpg".
 * While `photo` is null, the section shows without it.
 */
export const FAMILY = {
  photo: "/hosts/family.jpg" as string | null,
  alt: "Frosina with her husband Nikola, their daughter and son",
  caption: "Frosina, Nikola and their family, who look after both houses",
};

/** Digits only, for wa.me / viber links. */
export function phoneDigits(phone: string) {
  return phone.replace(/[^\d]/g, "").replace(/^00/, "");
}
