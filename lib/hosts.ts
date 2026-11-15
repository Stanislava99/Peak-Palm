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
};

export const HOSTS: Host[] = [
  {
    name: "Frosina",
    role: "Your host · with her family",
    photo: null,
    bio: "Sea & Ski is a family business. Frosina runs both houses together with her husband, their daughter and their son: Villa Kaja in the mountains at Bansko, and Jani’s Beach House by the sea in Neoi Epivates. Book direct and you deal with the family from the first question to the keys: arrival times, extra beds, where to eat, how the sauna works.",
    superhost: true,
    languages: [],
    houses: ["kaja", "janis"],
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
  alt: "Frosina with her husband, daughter and son",
  caption: "Frosina and her family, who look after both houses",
};
