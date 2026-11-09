import type { PropertyId } from "./properties";
import { dbConfigured } from "./db";

export type Question = {
  id: string;
  property: PropertyId;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

/** Questions from the website are emailed to the hosts and, with the database, kept in the questions table. */
export async function saveQuestion(entry: Question) {
  if (!dbConfigured()) throw new Error("no database");
  const { addQuestion } = await import("./booking-store");
  await addQuestion(entry.property, entry.name, entry.email, entry.message);
}
