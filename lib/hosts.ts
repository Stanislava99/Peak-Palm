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
    role: "Your host · both houses",
    photo: null,
    bio: "Frosina looks after both houses herself: Villa Kaja in the mountains at Bansko, and Jani’s Beach House by the sea in Neoi Epivates. Book direct and you deal with her from the first question to the keys: arrival times, extra beds, where to eat, how the sauna works.",
    superhost: true,
    languages: [],
    houses: ["kaja", "janis"],
  },
];

export function hostsFor(property: PropertyId) {
  return HOSTS.filter((host) => host.houses.includes(property));
}
