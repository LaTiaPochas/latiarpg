import fs from "fs";

let code = fs.readFileSync("src/components/combat/use-combat-enemy-turn.ts", "utf8");

code = code.replace(
  /function pickAvailableEnemySkill\(enemy: CombatEncounterEnemyView\): EnemySkillDecision \| null \{\n/,
  "function pickAvailableEnemySkill(enemy: CombatEncounterEnemyView): EnemySkillDecision | null {\n    const deps = depsRef.current;\n",
);

code = code.replace(
  /function resolveSkipTurnConditionsForActor\(\n  targetKind: "player" \| "enemy",\n  targetId: string,\n  affectedName: string,\n\): boolean \{\n/,
  `function resolveSkipTurnConditionsForActor(
  targetKind: "player" | "enemy",
  targetId: string,
  affectedName: string,
): boolean {
    const deps = depsRef.current;
`,
);

code = code.replace(/(\{\s*\n(?:\s*deps\.\w+,\s*\n)+)/g, (block) => {
  return block.replace(/^\s*deps\.(\w+),/gm, "      $1: deps.$1,");
});

code = code.replace(/\[\s*\n(\s*deps\.\w+,\s*\n)+\s*\]/g, (block) => {
  return block.replace(/deps\.(\w+)/g, "$1");
});

code = code.replace(
  /useEffect\(\(\) => \{\n    if \(deps\.combatOutcome !== "active"\) return;\n    if \(!deps\.currentActor \|\| deps\.currentActor\.type !== "enemy"\) return;\n    if \(deps\.isInitialCombatDelay \|\| deps\.isTurnTransitioning\)/,
  `useEffect(() => {
    const deps = depsRef.current;
    if (deps.combatOutcome !== "active") return;
    if (!deps.currentActor || deps.currentActor.type !== "enemy") return;
    if (deps.isInitialCombatDelay || deps.isTurnTransitioning)`,
);

const hookBody = code
  .replace(/^export function useCombatEnemyTurn[\s\S]*?\{\n/, "")
  .replace(/\n\}\s*$/, "");

const indented = hookBody
  .split("\n")
  .map((line) => (line.length ? `  ${line}` : line))
  .join("\n");

code = `export function useCombatEnemyTurn(depsRef: MutableRefObject<CombatEnemyTurnDeps>) {\n${indented}\n}\n`;

code = code.replace(
  `"use client";\n\nimport { useEffect, type MutableRefObject } from "react";`,
  `"use client";\n\nimport { useEffect, type MutableRefObject } from "react";\nimport type { PlayerSkillEffectSubtype } from "@/lib/enemy-skill-combat";`,
);

fs.writeFileSync("src/components/combat/use-combat-enemy-turn.ts", code.replace(/^\uFEFF/, ""), "utf8");
console.log("Fixed use-combat-enemy-turn.ts");
