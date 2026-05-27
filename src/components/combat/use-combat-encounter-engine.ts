"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";

import type { CombatAtbTimelineEntry } from "@/components/combat/combat-atb-timeline";
import type { CombatOutcome, CombatTurnActor } from "@/components/combat/combat-turn-types";
import type { CombatEncounterEnemyView } from "@/components/combat/types";
import {
  advanceAtbAfterAction,
  createInitialAtbGauges,
  predictAtbTimeline,
  pruneAtbGaugesForCombatants,
  resolveNextAtbActor,
  type AtbCombatant,
  type AtbGaugeMap,
} from "@/lib/combat-atb";

export const COMBAT_MAX_ENEMIES_ON_FIELD = 4;
export const COMBAT_ACTION_DELAY_MS = 1000;
export const COMBAT_FIRST_ACTION_DELAY_MS = 3000;

export type UseCombatEncounterEngineInput = {
  encounterCode: string;
  enemies: CombatEncounterEnemyView[];
  playerCurrentHp: number;
  playerSpeed: number;
  playerCombatSpeedBonus: number;
  playerTimedSpeedBonus: number;
  resolveEnemySpeed: (enemy: CombatEncounterEnemyView) => number;
  playerDisplayName: string;
  playerPortraitSrc?: string | null;
  defaultPlayerPortrait: string;
  /** Tras actuar el PJ (cooldowns de skills, etc.). */
  onAfterPlayerActs?: () => void;
};

export type CombatEncounterEngine = {
  displayEnemies: CombatEncounterEnemyView[];
  setDisplayEnemies: Dispatch<SetStateAction<CombatEncounterEnemyView[]>>;
  displayEnemiesRef: RefObject<CombatEncounterEnemyView[]>;
  combatOutcome: CombatOutcome;
  setCombatOutcome: Dispatch<SetStateAction<CombatOutcome>>;
  selectedEnemyId: string | null;
  setSelectedEnemyId: Dispatch<SetStateAction<string | null>>;
  turn: number;
  setTurn: Dispatch<SetStateAction<number>>;
  currentActorId: string | null;
  currentActor: CombatTurnActor | null;
  isPlayerTurn: boolean;
  atbGauges: AtbGaugeMap;
  atbActionSeq: number;
  atbTimelineEntries: CombatAtbTimelineEntry[];
  isTurnTransitioning: boolean;
  setIsTurnTransitioning: Dispatch<SetStateAction<boolean>>;
  isInitialCombatDelay: boolean;
  hasAnyEnemy: boolean;
  hasAliveEnemies: boolean;
  advanceTurn: () => void;
  scheduleAdvanceTurn: () => void;
  /** Para turno enemigo: clave ya resuelta `seq:actorId`. */
  resolvedEnemyTurnRef: MutableRefObject<string | null>;
  currentActorIdRef: RefObject<string | null>;
  atbActionSeqRef: MutableRefObject<number>;
};

export function useCombatEncounterEngine(
  input: UseCombatEncounterEngineInput,
): CombatEncounterEngine {
  const {
    encounterCode,
    enemies,
    playerCurrentHp,
    playerSpeed,
    playerCombatSpeedBonus,
    playerTimedSpeedBonus,
    resolveEnemySpeed,
    playerDisplayName,
    playerPortraitSrc,
    defaultPlayerPortrait,
    onAfterPlayerActs,
  } = input;

  const initialEnemies = useMemo(
    () => enemies.slice(0, COMBAT_MAX_ENEMIES_ON_FIELD),
    [enemies],
  );

  const [displayEnemies, setDisplayEnemies] = useState<CombatEncounterEnemyView[]>(initialEnemies);
  const displayEnemiesRef = useRef(displayEnemies);
  useEffect(() => {
    displayEnemiesRef.current = displayEnemies;
  }, [displayEnemies]);

  const [combatOutcome, setCombatOutcome] = useState<CombatOutcome>("active");
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEnemyId) return;
    const sel = displayEnemies.find((e) => e.id === selectedEnemyId);
    if (!sel || sel.hp <= 0) setSelectedEnemyId(null);
  }, [displayEnemies, selectedEnemyId]);

  const [turn, setTurn] = useState(1);
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(true);
  const [isInitialCombatDelay, setIsInitialCombatDelay] = useState(true);

  const advanceTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnAdvanceGenerationRef = useRef(0);
  const lastCommittedTurnAdvanceGenRef = useRef(0);
  const initialActionDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedEnemyTurnRef = useRef<string | null>(null);

  const atbCombatants = useMemo<AtbCombatant[]>(() => {
    const list: AtbCombatant[] = [];
    if (playerCurrentHp > 0) {
      list.push({
        id: "player",
        speed: Math.max(
          0,
          Math.trunc(playerSpeed + playerCombatSpeedBonus + playerTimedSpeedBonus),
        ),
        alive: true,
      });
    }
    for (const enemy of displayEnemies) {
      if (enemy.hp <= 0) continue;
      list.push({
        id: `enemy:${enemy.id}`,
        speed: resolveEnemySpeed(enemy),
        alive: true,
      });
    }
    return list;
  }, [
    displayEnemies,
    playerCombatSpeedBonus,
    playerCurrentHp,
    playerSpeed,
    playerTimedSpeedBonus,
    resolveEnemySpeed,
  ]);

  const atbCombatantsRef = useRef(atbCombatants);
  useEffect(() => {
    atbCombatantsRef.current = atbCombatants;
  }, [atbCombatants]);

  const atbRosterSig = useMemo(
    () => atbCombatants.map((c) => `${c.id}:${c.speed}`).join("|"),
    [atbCombatants],
  );

  const [atbGauges, setAtbGauges] = useState<AtbGaugeMap>({});
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [atbActionSeq, setAtbActionSeq] = useState(0);
  const atbActionSeqRef = useRef(atbActionSeq);
  useEffect(() => {
    atbActionSeqRef.current = atbActionSeq;
  }, [atbActionSeq]);

  const atbGaugesRef = useRef(atbGauges);
  const currentActorIdRef = useRef(currentActorId);
  const actedThisRoundRef = useRef<Set<string>>(new Set());
  const prevEncounterCodeForAtbRef = useRef(encounterCode);

  useEffect(() => {
    atbGaugesRef.current = atbGauges;
  }, [atbGauges]);
  useEffect(() => {
    currentActorIdRef.current = currentActorId;
  }, [currentActorId]);

  useLayoutEffect(() => {
    const needsFullInit =
      prevEncounterCodeForAtbRef.current !== encounterCode ||
      Object.keys(atbGaugesRef.current).length === 0;

    if (needsFullInit) {
      prevEncounterCodeForAtbRef.current = encounterCode;
      actedThisRoundRef.current = new Set();
      resolvedEnemyTurnRef.current = null;
      setAtbActionSeq(0);
      const gauges = createInitialAtbGauges(atbCombatants);
      const nextId = resolveNextAtbActor({ ...gauges }, atbCombatants);
      setAtbGauges(gauges);
      setCurrentActorId(nextId);
      return;
    }

    const pruned = pruneAtbGaugesForCombatants(atbGaugesRef.current, atbCombatants);
    const aliveIds = new Set(atbCombatants.filter((c) => c.alive).map((c) => c.id));
    let nextGauges = pruned;
    let nextActorId = currentActorIdRef.current;

    if (!nextActorId || !aliveIds.has(nextActorId)) {
      const sim = { ...pruned };
      nextActorId = resolveNextAtbActor(sim, atbCombatants);
      nextGauges = sim;
      resolvedEnemyTurnRef.current = null;
    }

    setAtbGauges(nextGauges);
    if (nextActorId !== currentActorIdRef.current) {
      setCurrentActorId(nextActorId);
    }
  }, [encounterCode, atbRosterSig, atbCombatants]);

  const currentActor = useMemo((): CombatTurnActor | null => {
    if (!currentActorId) return null;
    if (currentActorId === "player") {
      const speed = Math.max(
        0,
        Math.trunc(playerSpeed + playerCombatSpeedBonus + playerTimedSpeedBonus),
      );
      return { id: "player", type: "player", speed };
    }
    const enemyId = currentActorId.startsWith("enemy:")
      ? currentActorId.slice("enemy:".length)
      : null;
    if (!enemyId) return null;
    const enemy = displayEnemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.hp <= 0) return null;
    return {
      id: currentActorId,
      type: "enemy",
      speed: resolveEnemySpeed(enemy),
      enemyId,
    };
  }, [
    currentActorId,
    displayEnemies,
    playerCombatSpeedBonus,
    playerSpeed,
    playerTimedSpeedBonus,
    resolveEnemySpeed,
  ]);

  const playerPortraitForAtb =
    typeof playerPortraitSrc === "string" && playerPortraitSrc.trim().length > 0
      ? playerPortraitSrc.trim()
      : defaultPlayerPortrait;

  const atbTimelineEntries = useMemo((): CombatAtbTimelineEntry[] => {
    const slotCount = Math.min(8, Math.max(3, atbCombatants.length + 2));
    const order = predictAtbTimeline(atbGauges, atbCombatants, slotCount);
    return order.map((id) => {
      if (id === "player") {
        return {
          id,
          label: playerDisplayName,
          portraitSrc: playerPortraitForAtb,
          isPlayer: true,
          isCurrent: id === currentActorId,
          gauge: atbGauges[id] ?? 0,
        };
      }
      const enemyId = id.startsWith("enemy:") ? id.slice("enemy:".length) : "";
      const enemy = displayEnemies.find((e) => e.id === enemyId);
      return {
        id,
        label: enemy?.name ?? "Enemigo",
        portraitSrc:
          enemy?.portraitSrc && enemy.portraitSrc.trim().length > 0
            ? enemy.portraitSrc.trim()
            : null,
        isPlayer: false,
        isCurrent: id === currentActorId,
        gauge: atbGauges[id] ?? 0,
      };
    });
  }, [
    atbCombatants,
    atbGauges,
    currentActorId,
    displayEnemies,
    playerDisplayName,
    playerPortraitForAtb,
  ]);

  const advanceTurn = useCallback(() => {
    const actedId = currentActorIdRef.current;
    if (!actedId) return;

    const combatants = atbCombatantsRef.current;
    const gauges = { ...atbGaugesRef.current };
    const nextId = advanceAtbAfterAction(gauges, combatants, actedId);

    const acted = new Set(actedThisRoundRef.current);
    acted.add(actedId);
    const aliveCanAct = combatants.filter((c) => c.alive && c.speed > 0).map((c) => c.id);
    if (aliveCanAct.length > 0 && aliveCanAct.every((id) => acted.has(id))) {
      actedThisRoundRef.current = new Set();
      setTurn((t) => t + 1);
    } else {
      actedThisRoundRef.current = acted;
    }

    setAtbGauges(gauges);
    if (nextId) setCurrentActorId(nextId);
  }, []);

  const onAfterPlayerActsRef = useRef(onAfterPlayerActs);
  useEffect(() => {
    onAfterPlayerActsRef.current = onAfterPlayerActs;
  }, [onAfterPlayerActs]);

  const commitScheduledTurnAdvance = useCallback(
    (generation: number) => {
      if (generation !== turnAdvanceGenerationRef.current) return;
      if (generation === lastCommittedTurnAdvanceGenRef.current) return;
      lastCommittedTurnAdvanceGenRef.current = generation;

      if (advanceTurnTimeoutRef.current) {
        clearTimeout(advanceTurnTimeoutRef.current);
        advanceTurnTimeoutRef.current = null;
      }
      resolvedEnemyTurnRef.current = null;

      const actedId = currentActorIdRef.current;
      if (actedId === "player") {
        onAfterPlayerActsRef.current?.();
      }
      advanceTurn();
      setAtbActionSeq((seq) => seq + 1);
      setIsTurnTransitioning(false);
    },
    [advanceTurn],
  );

  const scheduleAdvanceTurn = useCallback(() => {
    if (advanceTurnTimeoutRef.current) {
      clearTimeout(advanceTurnTimeoutRef.current);
      advanceTurnTimeoutRef.current = null;
    }
    turnAdvanceGenerationRef.current += 1;
    const generation = turnAdvanceGenerationRef.current;
    setIsTurnTransitioning(true);
    advanceTurnTimeoutRef.current = setTimeout(() => {
      commitScheduledTurnAdvance(generation);
    }, COMBAT_ACTION_DELAY_MS);
  }, [commitScheduledTurnAdvance]);

  useEffect(
    () => () => {
      if (advanceTurnTimeoutRef.current) {
        clearTimeout(advanceTurnTimeoutRef.current);
        advanceTurnTimeoutRef.current = null;
      }
      if (initialActionDelayTimeoutRef.current) {
        clearTimeout(initialActionDelayTimeoutRef.current);
        initialActionDelayTimeoutRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (advanceTurnTimeoutRef.current) {
      clearTimeout(advanceTurnTimeoutRef.current);
      advanceTurnTimeoutRef.current = null;
    }
    if (initialActionDelayTimeoutRef.current) {
      clearTimeout(initialActionDelayTimeoutRef.current);
      initialActionDelayTimeoutRef.current = null;
    }
    resolvedEnemyTurnRef.current = null;
    turnAdvanceGenerationRef.current = 0;
    lastCommittedTurnAdvanceGenRef.current = 0;
    setAtbActionSeq(0);
    setIsInitialCombatDelay(true);
    setIsTurnTransitioning(true);
    initialActionDelayTimeoutRef.current = setTimeout(() => {
      setIsInitialCombatDelay(false);
      setIsTurnTransitioning(false);
      initialActionDelayTimeoutRef.current = null;
    }, COMBAT_FIRST_ACTION_DELAY_MS);
  }, [encounterCode]);

  useEffect(() => {
    if (!isTurnTransitioning) return;
    const generationAtTransition = turnAdvanceGenerationRef.current;
    const safetyMs = COMBAT_ACTION_DELAY_MS + 800;
    const safetyId = setTimeout(() => {
      if (lastCommittedTurnAdvanceGenRef.current < generationAtTransition) {
        commitScheduledTurnAdvance(turnAdvanceGenerationRef.current);
        return;
      }
      if (advanceTurnTimeoutRef.current) {
        clearTimeout(advanceTurnTimeoutRef.current);
        advanceTurnTimeoutRef.current = null;
      }
      resolvedEnemyTurnRef.current = null;
      setIsTurnTransitioning(false);
    }, safetyMs);
    return () => clearTimeout(safetyId);
  }, [isTurnTransitioning, commitScheduledTurnAdvance]);

  const hasAnyEnemy = displayEnemies.length > 0;
  const hasAliveEnemies = displayEnemies.some((enemy) => enemy.hp > 0);
  const isPlayerTurn = currentActor?.type === "player";

  return {
    displayEnemies,
    setDisplayEnemies,
    displayEnemiesRef,
    combatOutcome,
    setCombatOutcome,
    selectedEnemyId,
    setSelectedEnemyId,
    turn,
    setTurn,
    currentActorId,
    currentActor,
    isPlayerTurn,
    atbGauges,
    atbActionSeq,
    atbTimelineEntries,
    isTurnTransitioning,
    setIsTurnTransitioning,
    isInitialCombatDelay,
    hasAnyEnemy,
    hasAliveEnemies,
    advanceTurn,
    scheduleAdvanceTurn,
    resolvedEnemyTurnRef,
    currentActorIdRef,
    atbActionSeqRef,
  };
}
