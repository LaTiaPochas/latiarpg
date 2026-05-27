/** Actor en cola ATB (PJ o enemigo con id `enemy:{spawnId}`). */
export type CombatTurnActor = {
  id: string;
  type: "player" | "enemy";
  speed: number;
  enemyId?: string;
};

export type CombatOutcome = "active" | "won" | "lost";
