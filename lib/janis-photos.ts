import type { Photo } from "./photos";

export const janisRooms = ["All", "Beach", "Terrace", "Yard", "Living", "Kitchen", "Bedrooms"] as const;

export const janisPhotos: Photo[] = [
  {
    src: "/photos/janis/01-cover.jpg",
    alt: "Palm trees and a paved path leading from the house to the sandy beach and the Thermaic Gulf",
    caption: "The path down to the beach",
    room: "Beach",
  },
  {
    src: "/photos/janis/16-sea.jpg",
    alt: "View between palms and hedges toward the sea, with the house balcony on the left",
    caption: "Sea from the front of the house",
    room: "Beach",
  },
  {
    src: "/photos/janis/18-our-beach.jpg",
    alt: "Waves on a sandy beach, with the Thessaloniki shoreline and mountains across the gulf",
    caption: "The beach in front of the house",
    room: "Beach",
  },
  {
    src: "/photos/janis/17-sunset.jpg",
    alt: "Sunset over the gulf, seen from the sand",
    caption: "Sunset on the sand",
    room: "Beach",
  },
  {
    src: "/photos/janis/15-beach.jpg",
    alt: "Balcony table and chairs looking over a blue railing to the sea",
    caption: "Sea-view balcony",
    room: "Terrace",
  },
  {
    src: "/photos/janis/03-cover.jpg",
    alt: "Breakfast set on the balcony table, with the sea beyond the railing",
    caption: "Breakfast on the balcony",
    room: "Terrace",
  },
  {
    src: "/photos/janis/10-balcony.jpg",
    alt: "Small balcony with a wooden table, striped cushions, and a view over neighbouring houses",
    caption: "Balcony off the upper bedrooms",
    room: "Terrace",
  },
  {
    src: "/photos/janis/14-yard.jpg",
    alt: "Backyard seating with grey sofas, a wooden table, plants, and a white wall",
    caption: "Backyard seating",
    room: "Yard",
  },
  {
    src: "/photos/janis/02-cover.jpg",
    alt: "Open living room with sofas, coffee tables, and the kitchen and dining table beyond",
    caption: "Living room, kitchen, and dining",
    room: "Living",
  },
  {
    src: "/photos/janis/04-cover.jpg",
    alt: "Sofa with patterned cushions in front of a white brick wall and the dining table",
    caption: "Living and dining",
    room: "Living",
  },
  {
    src: "/photos/janis/19-entrance.jpg",
    alt: "Marble stairs beside a glass floor and a small table with yellow flowers",
    caption: "Stairs up to the bedrooms",
    room: "Living",
  },
  {
    src: "/photos/janis/20-extra.jpg",
    alt: "Wooden dining table set with white bowls, linen placemats, and glasses",
    caption: "The dining table",
    room: "Kitchen",
  },
  {
    src: "/photos/janis/06-kitchen.jpg",
    alt: "Kitchen in the half-basement of Jani's Beach House",
    caption: "Kitchen",
    room: "Kitchen",
  },
  {
    src: "/photos/janis/07-kitchen-2.jpg",
    alt: "Another view of the kitchen",
    caption: "Kitchen",
    room: "Kitchen",
  },
  {
    src: "/photos/janis/08-bedroom.jpg",
    alt: "Enclosed bedroom",
    caption: "Bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/janis/09-seaview-room.jpg",
    alt: "Breakfast on the balcony table, with the sea beyond the blue railing",
    caption: "The sea from the balcony table",
    room: "Terrace",
  },
  {
    src: "/photos/janis/11-bedroom-202.jpg",
    alt: "Bedroom with its own bathroom",
    caption: "Upper bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/janis/12-bedroom-203.jpg",
    alt: "Bedroom that opens to a duplex attic",
    caption: "Duplex bedroom",
    room: "Bedrooms",
  },
  {
    src: "/photos/janis/13-attic.jpg",
    alt: "Folded towels and pillows on a made bed",
    caption: "Towels on the bed",
    room: "Bedrooms",
  },
];
