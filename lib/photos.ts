export type Photo = {
  src: string;
  alt: string;
  caption: string;
  room: string;
};

export const photos: Photo[] = [
  {
    src: "/photos/01-exterior.jpg",
    alt: "White and stone facade of Villa Kaja with the name painted beside the balcony",
    caption: "The chalet, with the name on the wall",
    room: "Outside",
  },
  {
    src: "/photos/20-exterior.jpg",
    alt: "Another view of the Villa Kaja exterior",
    caption: "Street front",
    room: "Outside",
  },
  {
    src: "/photos/17-patio.jpg",
    alt: "Patio at Villa Kaja",
    caption: "Patio",
    room: "Outside",
  },
  {
    src: "/photos/19-garden.jpg",
    alt: "Garden beside the chalet",
    caption: "Garden",
    room: "Outside",
  },
  {
    src: "/photos/02-living.jpg",
    alt: "Open living and dining room with a red leather sofa, oak table, and foosball table",
    caption: "Living and dining room",
    room: "Living",
  },
  {
    src: "/photos/03-living.jpg",
    alt: "Living area at Villa Kaja",
    caption: "Lounge",
    room: "Living",
  },
  {
    src: "/photos/04-living.jpg",
    alt: "Seating in the living room",
    caption: "Shared lounge",
    room: "Living",
  },
  {
    src: "/photos/05-living.jpg",
    alt: "Wide view of the living space",
    caption: "The whole floor",
    room: "Living",
  },
  {
    src: "/photos/18-games.jpg",
    alt: "Foosball table in the games corner",
    caption: "Foosball",
    room: "Living",
  },
  {
    src: "/photos/06-kitchen.jpg",
    alt: "Kitchen at Villa Kaja",
    caption: "Kitchen",
    room: "Kitchen",
  },
  {
    src: "/photos/07-kitchen.jpg",
    alt: "Second view of the kitchen",
    caption: "Cook for the group",
    room: "Kitchen",
  },
  {
    src: "/photos/08-bedroom-1.jpg",
    alt: "Bedroom with a large bed, turquoise cushions, and robes",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/09-bedroom-2.jpg",
    alt: "Second bedroom",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/10-bedroom-3.jpg",
    alt: "Third bedroom",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/11-bedroom-4.jpg",
    alt: "Fourth bedroom",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/12-bedroom-5.jpg",
    alt: "Fifth bedroom",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/13-apartment.jpg",
    alt: "The larger apartment bedroom with extra beds",
    caption: "Quad apartment",
    room: "Bedrooms",
  },
  {
    src: "/photos/14-bathroom.jpg",
    alt: "Ensuite bathroom",
    caption: "Ensuite bathroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/15-sauna.jpg",
    alt: "Private pine sauna opening onto a shower",
    caption: "Private sauna and shower",
    room: "Sauna",
  },
  {
    src: "/photos/21-sauna.jpg",
    alt: "Sauna benches in light pine",
    caption: "Sauna",
    room: "Sauna",
  },
  {
    src: "/photos/16-ski.jpg",
    alt: "Wooden ski rack against a stone wall",
    caption: "Ski storage",
    room: "Outside",
  },
];

export const rooms = ["All", "Outside", "Living", "Kitchen", "Bedrooms", "Sauna"] as const;
