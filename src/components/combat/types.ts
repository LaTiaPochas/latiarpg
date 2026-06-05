import type { ParsedEnemySkillEffect } from "@/lib/enemy-skill-combat";
import type { CombatAmmoSpentEntry } from "@/lib/combat-persist-ammo";

export type { CombatAmmoSpentEntry };

export type CombatEncounterEnemySkill = {
  id: string;
  name: string;
  description: string | null;
  cooldownTurns: number;
  manaCost: number;
  parsedEffect: ParsedEnemySkillEffect;
};

/** Skill del PJ aprendido (`user_character_skills`) + datos de `player_skills` para combate. */
export type CombatPlayerSkillView = {
  /** PK de `user_character_skills`. */
  userCharacterSkillId: string;
  learnedAt: string | null;
  skill: {
    id: string;
    code: string | null;
    name: string;
    description: string | null;
    manaCost: number;
    cooldownTurns: number;
    target: string;
    /** `effect_json` tal como viene de BD (parseado como objeto). */
    effect: Record<string, unknown>;
  };
};

/** Datos del enemigo para UI + lógica de combate en cliente (HP visible en panel por enemigo). */
export type CombatEncounterEnemyView = {
  id: string;
  templateId: string | null;
  /** `enemy_templates.creature_type` (stats de bajas en biblioteca). */
  creatureType: string | null;
  spawnIndex: number;
  name: string;
  enemyLevel: number | null;
  portraitSrc: string | null;
  spriteSrc: string | null;
  spriteOffsetX: number;
  spriteOffsetY: number;
  mobileSpriteOffsetX: number;
  mobileSpriteOffsetY: number;
  spriteScale: number;
  spriteZIndex: number;
  xpReward: number;
  goldRewards: number;
  hp: number;
  hpMax: number;
  mana: number;
  armor: number;
  mr: number;
  speed: number;
  attackMin: number;
  attackMax: number;
  magicMin: number;
  magicMax: number;
  skills: CombatEncounterEnemySkill[];
  levelOverride: number | null;
  aiProfile: string | null;
  resistances: string[];
  weaknesses: string[];
};

export type CombatVictoryLootItem = {
  lootKey: string;
  itemId: string;
  name: string;
  iconPath: string | null;
  quantity: number;
  description: string | null;
  quoteText: string | null;
  sellValue: number;
  itemTypeId: number | null;
  itemTypeCode: string | null;
  rarityColor: string | null;
  weaponInstance?: {
    rarity: string | null;
    rarityColor: string | null;
    attackFamily: string | null;
    attackDamageMin: number | null;
    attackDamageMax: number | null;
    magicDamageMin: number | null;
    magicDamageMax: number | null;
    statKey1: string | null;
    valueFlat1: number | null;
    valuePct1: number | null;
    statKey2: string | null;
    valueFlat2: number | null;
    valuePct2: number | null;
    statKey3: string | null;
    valueFlat3: number | null;
    valuePct3: number | null;
    statKey4: string | null;
    valueFlat4: string | number | null;
    valuePct4: number | null;
    statKey5: string | null;
    valueFlat5: string | number | null;
    valuePct5: number | null;
  } | null;
  equipmentInstance?: {
    rarity: string | null;
    rarityColor: string | null;
    statKey1: string | null;
    valueFlat1: number | null;
    valuePct1: number | null;
    statKey2: string | null;
    valueFlat2: number | null;
    valuePct2: number | null;
    statKey3: string | null;
    valueFlat3: number | null;
    valuePct3: number | null;
    statKey4: string | null;
    valueFlat4: string | number | null;
    valuePct4: number | null;
    statKey5: string | null;
    valueFlat5: string | number | null;
    valuePct5: number | null;
  } | null;
};

export type CombatDefeatLostItem = {
  inventoryId: number;
  name: string;
  iconPath: string | null;
  quantityLost: number;
};

export type CombatPlayerConsumableView = {
  inventoryId: number;
  itemId: string;
  name: string;
  description: string | null;
  iconPath: string | null;
  effect: Record<string, unknown> | null;
  quantity: number;
};

export type CombatConsumeResult = {
  ok: boolean;
  remainingQuantity?: number;
  error?: string;
};

export type CombatEncounterStatsPayload = {
  didWin: boolean;
  enemiesDefeated: number;
  bossesDefeated: number;
  totalDamageDealt: number;
  highestHitDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  highestHitReceived: number;
  finalHp: number;
  finalMana: number;
  ammoSpent?: CombatAmmoSpentEntry[];
};
