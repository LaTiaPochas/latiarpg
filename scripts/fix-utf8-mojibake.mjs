import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/components/combat");

function repairMojibake(text) {
  const repaired = Buffer.from(text, "latin1").toString("utf8");
  const badBefore = (text.match(/Ã|â€|â†|Â¿/g) ?? []).length;
  const badAfter = (repaired.match(/Ã|â€|â†|Â¿/g) ?? []).length;
  if (badAfter < badBefore) return repaired;
  return text;
}

const files = [
  "combat-encounter-shell.tsx",
  "use-combat-enemy-turn.ts",
  "use-combat-player-actions.ts",
  "combat-enemy-turn-utils.ts",
];

for (const file of files) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const original = fs.readFileSync(full, "utf8");
  const fixed = repairMojibake(original);
  if (fixed !== original) {
    fs.writeFileSync(full, fixed, "utf8");
    console.log("fixed", file);
  } else {
    console.log("unchanged", file);
  }
}
