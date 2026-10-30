import { writeFile } from "node:fs/promises";
import { guideSections } from "../src/guide-content.js";
const header =
  "# Bhoomi Land Stack — User Guide\n\nVersion 2 · SIH26014 · 30 October 2026\n\nLive app: https://bhoomi-landstack.onrender.com\n\nOnline guide: https://bhoomi-landstack.onrender.com/#guide\n\nSynthetic demonstration only. No government affiliation, legal title verification or actual government transactions. Avoid sensitive information.\n\n";
const text =
  header +
  guideSections
    .map(
      ([title, paragraphs], i) =>
        `## ${i + 1}. ${title}\n\n${paragraphs.join("\n\n")}\n`,
    )
    .join("\n");
await writeFile("OPERATOR_GUIDE.md", text);
await writeFile("public/user-guide.md", text);
console.log("User guide synchronized.");
