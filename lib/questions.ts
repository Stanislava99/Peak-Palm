import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PropertyId } from "./properties";

export type Question = {
  id: string;
  property: PropertyId;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

const filePath = path.join(process.cwd(), "data", "questions.json");

export async function saveQuestion(entry: Question) {
  let current: Question[] = [];
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Question[];
    current = Array.isArray(parsed) ? parsed : [];
  } catch {
    current = [];
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify([entry, ...current], null, 2));
}
