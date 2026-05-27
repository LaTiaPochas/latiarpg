import type { CombatEncounterConfig } from "@/components/combat/combat-encounter-config";
import type {
  CombatConsumeResult,
  CombatDefeatLostItem,
  CombatEncounterEnemyView,
  CombatEncounterStatsPayload,
  CombatPlayerConsumableView,
  CombatPlayerSkillView,
  CombatVictoryLootItem,
} from "@/components/combat/types";
import type { CombatAmmoSpentEntry } from "@/lib/combat-persist-ammo";

export type CombatEncounterShellProps = {
  encounterName: string;
  encounterCode: string;
  combatStep: string | null;
  isBoss: boolean;
  recommendedLevel: number | null;
  backgroundSrc: string | null;
  enemies: CombatEncounterEnemyView[];
  combatStartMessage?: string | null;
  playerDisplayName?: string;
  playerPortraitSrc?: string | null;
  playerSpriteSrc?: string;
  playerHp?: number;
  playerHpMax?: number;
  playerMana?: number;
  playerManaMax?: number;
  playerSpeed?: number;
  playerWeaponDamageMin?: number;
  playerWeaponDamageMax?: number;
  playerMagicDamageMin?: number;
  playerMagicDamageMax?: number;
  playerStatStr?: number;
  playerStatDex?: number;
  playerStatInt?: number;
  playerStatWis?: number;
  playerArmor?: number;
  playerMr?: number;
  playerResistances?: string[];
  playerWeaknesses?: string[];
  playerWeaponAttackFamily?: string | null;
  playerWeaponAmmoKind?: string | null;
  playerExperienceToNext?: number;
  playerLevelCurrent?: number;
  playerLevelAfterVictory?: number;
  playerSkills?: CombatPlayerSkillView[];
  playerConsumables?: CombatPlayerConsumableView[];
  victoryLootItems?: CombatVictoryLootItem[];
  defeatLostItems?: CombatDefeatLostItem[];
  victoryGoldFromLoot?: number;
  onConsumeConsumable?: (inventoryId: number) => Promise<CombatConsumeResult>;
  onEscapePersistState?: (payload: {
    finalHp: number;
    finalMana: number;
    ammoSpent?: CombatAmmoSpentEntry[];
  }) => Promise<void>;
  onPlayerDefeatedGlobalLog?: () => Promise<void>;
  onPlayerLevelUpGlobalLog?: (newLevel: number) => Promise<void>;
  onCombatFinishedStats?: (payload: CombatEncounterStatsPayload) => Promise<void>;
  escapeHref?: string;
  escapeDisabled?: boolean;
  disableEscapeByEnemyHp?: boolean;
  /** Preferí `config` para gauntlets y futuros modos. */
  config?: CombatEncounterConfig;
  /** @deprecated Usá `config` + `GauntletCombatShell`. */
  isGauntletCombat?: boolean;
  /** @deprecated */
  gauntletVictoryHref?: string;
  /** @deprecated */
  gauntletDefeatHref?: string;
  gauntletRunId?: string;
  gauntletFloor?: number;
  combatDebugEnabled?: boolean;
};

export type GauntletCombatShellProps = Omit<
  CombatEncounterShellProps,
  | "config"
  | "isGauntletCombat"
  | "gauntletVictoryHref"
  | "gauntletDefeatHref"
  | "gauntletRunId"
  | "gauntletFloor"
> & {
  gauntletRunId: string;
  gauntletFloor: number;
  gauntletVictoryHref: string;
  gauntletDefeatHref: string;
  /** Href de “escape” / navegación por defecto (prep o siguiente piso). */
  defaultNavigationHref?: string;
};
