"use client";

import Image from "next/image";
import { Libre_Baskerville } from "next/font/google";
import { Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { markIntroCompleted } from "./actions";

const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";
const ENEMY_BLACKWOLF_2 = "/img/resources/enemigos/enemy_sprite_blackwolf_2.png";
const PJ_FEDE_RPG_FIGHT_STICK =
  "/img/resources/characters/pj_fede_rpg_fight_stick.png";
const ICON_XP = "/img/resources/iconos/icon_xp.png";
const ICON_GOLD = "/img/resources/iconos/icon_gold.png";

const MAX_PLAYER_HP = 100;
const MAX_PLAYER_MANA = 20;
const MAX_ENEMY_HP = 80;
const SKILL_CHARGED_HIT_MP_COST = 10;
const WOLF_ATTACK_DAMAGE = 10;
const PLAYER_ATK = 50;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const helpCardFont = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400"],
});

const menuFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function BatallaTutorialPage() {
  const router = useRouter();
  const combatLogRef = useRef<HTMLDivElement | null>(null);

  const handleVictoryContinue = useCallback(async () => {
    await markIntroCompleted();
    router.push("/fin-tutorial");
  }, [router]);
  const turnRef = useRef(1);
  const wolfAttackTimeoutRef = useRef<number | null>(null);
  const enemyAttackDelayTimeoutRef = useRef<number | null>(null);
  const postEnemyAttackDelayTimeoutRef = useRef<number | null>(null);
  const [actionMenu, setActionMenu] = useState<"main" | "skills">("main");
  const [isIntroTutorialOpen, setIsIntroTutorialOpen] = useState(true);
  const [isSkillTutorialOpen, setIsSkillTutorialOpen] = useState(false);
  const [didShowSkillTutorial, setDidShowSkillTutorial] = useState(false);
  const [didInitialEnemyAttack, setDidInitialEnemyAttack] = useState(false);
  const [isWolfAttacking, setIsWolfAttacking] = useState(false);
  const [isActionLocked, setIsActionLocked] = useState(false);
  const [isCombatFinished, setIsCombatFinished] = useState(false);
  const [skillInfoTooltip, setSkillInfoTooltip] = useState<{
    open: boolean;
    x: number;
    y: number;
    pinned: boolean;
  }>({ open: false, x: 0, y: 0, pinned: false });
  const [turnOwner, setTurnOwner] = useState<"player" | "enemy">("enemy");
  const [turn, setTurn] = useState(1);
  const [playerHp, setPlayerHp] = useState(MAX_PLAYER_HP);
  const [playerMana, setPlayerMana] = useState(MAX_PLAYER_MANA);
  const [enemyHp, setEnemyHp] = useState(MAX_ENEMY_HP);
  const [combatLog, setCombatLog] = useState<string[]>([
    "Black Wolf aparece entre los árboles.",
  ]);

  const pushLog = (line: string) => setCombatLog((prev) => [...prev, line]);
  const chargedHitDamage = Math.floor(PLAYER_ATK + 5 + PLAYER_ATK * 0.5);

  const nextTurn = () => {
    const currentTurn = turnRef.current;
    turnRef.current += 1;
    setTurn(turnRef.current);
    return currentTurn;
  };

  const triggerWolfAttackAnimation = () => {
    setIsActionLocked(true);
    setIsWolfAttacking(true);
    if (wolfAttackTimeoutRef.current) {
      window.clearTimeout(wolfAttackTimeoutRef.current);
    }
    wolfAttackTimeoutRef.current = window.setTimeout(() => {
      setIsWolfAttacking(false);
      wolfAttackTimeoutRef.current = null;
    }, 220);
  };

  const scheduleEnemyTurn = (delayBeforeAttackMs = 1000) => {
    if (isCombatFinished) return;
    setTurnOwner("enemy");
    setIsActionLocked(true);
    if (enemyAttackDelayTimeoutRef.current) {
      window.clearTimeout(enemyAttackDelayTimeoutRef.current);
    }
    if (postEnemyAttackDelayTimeoutRef.current) {
      window.clearTimeout(postEnemyAttackDelayTimeoutRef.current);
    }

    enemyAttackDelayTimeoutRef.current = window.setTimeout(() => {
      triggerWolfAttackAnimation();
      const nextPlayerHp = clamp(playerHp - WOLF_ATTACK_DAMAGE, 0, MAX_PLAYER_HP);
      setPlayerHp(nextPlayerHp);
      const currentTurn = nextTurn();
      pushLog(
        `Turno ${currentTurn}: Dark Wolf se abalanza sobre vos y provoca ${WOLF_ATTACK_DAMAGE} de daño.`,
      );
      setDidInitialEnemyAttack(true);
      enemyAttackDelayTimeoutRef.current = null;

      if (nextPlayerHp <= 0) {
        setIsCombatFinished(true);
        setIsActionLocked(true);
        return;
      }

      postEnemyAttackDelayTimeoutRef.current = window.setTimeout(() => {
        if (isCombatFinished) return;
        setIsActionLocked(false);
        setTurnOwner("player");
        postEnemyAttackDelayTimeoutRef.current = null;
      }, 1000);
    }, delayBeforeAttackMs);
  };

  const handleAttack = () => {
    if (isActionLocked || isCombatFinished || turnOwner !== "player") return;
    const damage = 9;
    const nextEnemyHp = clamp(enemyHp - damage, 0, MAX_ENEMY_HP);
    setEnemyHp(nextEnemyHp);
    const currentTurn = nextTurn();
    pushLog(`Turno ${currentTurn}: Fede ataca con el palo y provoca ${damage} de daño.`);
    if (nextEnemyHp <= 0) {
      setIsCombatFinished(true);
      setIsActionLocked(true);
      return;
    }
    scheduleEnemyTurn(1000);
  };

  const openSkillInfoTooltip = (x: number, y: number, pinned: boolean) => {
    setSkillInfoTooltip({
      open: true,
      x: Math.min(x + 12, window.innerWidth - 360),
      y: Math.min(y + 12, window.innerHeight - 170),
      pinned,
    });
  };

  const hideSkillInfoTooltip = () => {
    setSkillInfoTooltip((prev) =>
      prev.pinned ? prev : { open: false, x: 0, y: 0, pinned: false },
    );
  };

  const toggleSkillInfoTooltipPinned = (x: number, y: number) => {
    setSkillInfoTooltip((prev) =>
      prev.open && prev.pinned
        ? { open: false, x: 0, y: 0, pinned: false }
        : {
            open: true,
            x: Math.min(x + 12, window.innerWidth - 360),
            y: Math.min(y + 12, window.innerHeight - 170),
            pinned: true,
          },
    );
  };

  const handleSkill = () => {
    if (isActionLocked || isCombatFinished || turnOwner !== "player") return;
    if (!didShowSkillTutorial) {
      setIsSkillTutorialOpen(true);
      setDidShowSkillTutorial(true);
      return;
    }
    if (playerMana < SKILL_CHARGED_HIT_MP_COST) {
      pushLog(
        `Turno ${turn}: No tenes mana suficiente para usar Golpe cargado.`,
      );
      return;
    }
    const damage = chargedHitDamage;
    setPlayerMana((prev) => clamp(prev - SKILL_CHARGED_HIT_MP_COST, 0, MAX_PLAYER_MANA));
    const nextEnemyHp = clamp(enemyHp - damage, 0, MAX_ENEMY_HP);
    setEnemyHp(nextEnemyHp);
    const currentTurn = nextTurn();
    pushLog(`Turno ${currentTurn}: Fede usa Golpe cargado y provoca ${damage} de daño.`);
    if (nextEnemyHp <= 0) {
      setIsCombatFinished(true);
      setIsActionLocked(true);
      return;
    }
    scheduleEnemyTurn(1000);
  };

  const handleCloseIntroTutorial = () => {
    setIsIntroTutorialOpen(false);
    if (didInitialEnemyAttack) return;
    scheduleEnemyTurn(1000);
  };

  const playerHpPercent = Math.round((playerHp / MAX_PLAYER_HP) * 100);
  const playerManaPercent = Math.round((playerMana / MAX_PLAYER_MANA) * 100);
  const enemyHpPercent = Math.round((enemyHp / MAX_ENEMY_HP) * 100);
  const isVictory = enemyHp <= 0 && playerHp > 0;

  useEffect(() => {
    if (!combatLogRef.current) return;
    combatLogRef.current.scrollTop = combatLogRef.current.scrollHeight;
  }, [combatLog]);

  useEffect(() => {
    if (playerHp <= 0 || enemyHp <= 0) {
      setIsCombatFinished(true);
      setIsActionLocked(true);
      if (enemyAttackDelayTimeoutRef.current) {
        window.clearTimeout(enemyAttackDelayTimeoutRef.current);
        enemyAttackDelayTimeoutRef.current = null;
      }
      if (postEnemyAttackDelayTimeoutRef.current) {
        window.clearTimeout(postEnemyAttackDelayTimeoutRef.current);
        postEnemyAttackDelayTimeoutRef.current = null;
      }
    }
  }, [playerHp, enemyHp]);

  useEffect(() => {
    return () => {
      if (wolfAttackTimeoutRef.current) {
        window.clearTimeout(wolfAttackTimeoutRef.current);
      }
      if (enemyAttackDelayTimeoutRef.current) {
        window.clearTimeout(enemyAttackDelayTimeoutRef.current);
      }
      if (postEnemyAttackDelayTimeoutRef.current) {
        window.clearTimeout(postEnemyAttackDelayTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#120b08] text-amber-50">
      <Image
        src={BG_INTRO_FOREST}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col p-4 sm:p-6">
        <header
          className={`${menuFont.className} rounded-xl border border-amber-800/70 bg-[#1a100c]/88 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-4`}
        >
          <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">
                Fede
              </p>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-black/45">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                  style={{ width: `${playerHpPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-emerald-100/90">
                HP {playerHp} / {MAX_PLAYER_HP}
              </p>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-black/45">
                <div
                  className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-all duration-300"
                  style={{ width: `${playerManaPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-sky-100/90">
                Mana {playerMana} / {MAX_PLAYER_MANA}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <span
                  className={`text-lg font-bold transition-transform duration-200 sm:text-xl ${
                    turnOwner === "player"
                      ? "scale-115 text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                      : "text-amber-700/70"
                  }`}
                  aria-hidden
                >
                  &lt;
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/85">
                  Turno
                </p>
                <span
                  className={`text-lg font-bold transition-transform duration-200 sm:text-xl ${
                    turnOwner === "enemy"
                      ? "scale-115 text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                      : "text-amber-700/70"
                  }`}
                  aria-hidden
                >
                  &gt;
                </span>
              </div>
              <p className="text-3xl font-bold text-amber-100 sm:text-4xl">{turn}</p>
            </div>

            <div>
              <p className="text-right text-xs uppercase tracking-[0.16em] text-red-200/80">
                Blackwolf
              </p>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-black/45">
                <div
                  className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all duration-300"
                  style={{ width: `${enemyHpPercent}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-red-100/90">
                HP {enemyHp} / {MAX_ENEMY_HP}
              </p>
            </div>
          </div>
        </header>

        <main className="relative mt-4 flex flex-1 items-end justify-between overflow-hidden rounded-xl border border-amber-900/70 bg-black/15 p-3 shadow-[inset_0_-30px_60px_rgba(0,0,0,0.5)] sm:p-6">
          <div className="intro-character-slide-in pointer-events-none flex w-[42%] items-end justify-start">
            <Image
              src={PJ_FEDE_RPG_FIGHT_STICK}
              alt="Fede en combate"
              width={620}
              height={930}
              className="h-[min(52vh,360px)] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
            />
          </div>

          <div
            className={`intro-character-slide-in-right pointer-events-none flex w-[42%] items-end justify-end transition-transform duration-200 ease-out ${
              isWolfAttacking ? "-translate-x-12 sm:-translate-x-16" : "translate-x-0"
            }`}
          >
            <Image
              src={ENEMY_BLACKWOLF_2}
              alt="Blackwolf"
              width={420}
              height={420}
              className="h-[min(44vh,300px)] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
            />
          </div>
        </main>

        <section className="mt-4 grid gap-3 pb-1 sm:grid-cols-[0.9fr_1.5fr]">
          <div
            className={`${menuFont.className} rounded-xl border border-amber-800/70 bg-[#1a100c]/90 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-3`}
          >
            <div className="flex items-center gap-2">
              {actionMenu === "skills" && (
                <button
                  type="button"
                  onClick={() => setActionMenu("main")}
                  className="cursor-pointer rounded-md border border-amber-700/70 bg-amber-950/40 px-2 py-0.5 text-sm font-bold text-amber-200 transition hover:bg-amber-900/60"
                  aria-label="Volver a acciones"
                >
                  ←
                </button>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
                {actionMenu === "main" ? "Acciones" : "Habilidades"}
              </p>
            </div>

            {actionMenu === "main" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAttack}
                  disabled={isActionLocked}
                  className="w-full cursor-pointer rounded-md border border-slate-500/70 bg-slate-700/45 px-3 py-1.5 text-left text-sm font-semibold text-slate-100 transition hover:bg-slate-600/65 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Atacar
                </button>
                <button
                  type="button"
                  onClick={() => setActionMenu("skills")}
                  disabled={isActionLocked}
                  className="w-full cursor-pointer rounded-md border border-sky-600/70 bg-sky-900/45 px-3 py-1.5 text-left text-sm font-semibold text-sky-100 transition hover:bg-sky-800/65 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Habilidades
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-slate-500/70 bg-slate-700/45 px-3 py-1.5 text-left text-sm font-semibold text-slate-200/75 opacity-60"
                  aria-disabled="true"
                >
                  Inventario
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-md border border-red-700/70 bg-red-900/45 px-3 py-1.5 text-left text-sm font-semibold text-red-200/75 opacity-60"
                  aria-disabled="true"
                >
                  Huir
                </button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSkill}
                    disabled={isActionLocked || playerMana < SKILL_CHARGED_HIT_MP_COST}
                    className="w-full cursor-pointer rounded-md border border-sky-600/70 bg-sky-900/45 px-3 py-1.5 text-left text-sm font-semibold text-sky-100 transition hover:bg-sky-800/65 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Golpe cargado
                  </button>
                  <span className="shrink-0 rounded-md border border-sky-600/70 bg-sky-950/55 px-2 py-1 text-xs font-bold text-sky-200">
                    10 MP
                  </span>
                  <button
                    type="button"
                    onMouseEnter={(e) =>
                      openSkillInfoTooltip(e.clientX, e.clientY, false)
                    }
                    onMouseMove={(e) =>
                      openSkillInfoTooltip(e.clientX, e.clientY, false)
                    }
                    onMouseLeave={hideSkillInfoTooltip}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSkillInfoTooltipPinned(e.clientX, e.clientY);
                    }}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sky-500/80 bg-sky-900/60 text-xs font-black text-sky-100 transition hover:bg-sky-800/75"
                    aria-label="Información de Golpe cargado"
                  >
                    ?
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-800/70 bg-[#1a100c]/90 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-4">
            <p
              className={`${menuFont.className} text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90`}
            >
              Combat Log
            </p>
            <div
              ref={combatLogRef}
              className={`${helpCardFont.className} mt-3 min-h-28 max-h-28 space-y-1 overflow-y-auto pr-1 text-xs leading-relaxed text-amber-50/92 sm:text-sm`}
            >
              {combatLog.map((line, idx) => (
                <p key={`${line}-${idx}`} className="rounded-md bg-black/25 px-2 py-1">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isIntroTutorialOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
          <div
            className={`${helpCardFont.className} w-full max-w-2xl rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] sm:p-6`}
          >
            <p className="text-center text-sm font-normal leading-relaxed text-amber-50/80 sm:text-base">
              Fuiste atacado por un enemigo. <br/><br/>Cuando comienza un combate, se
              decide quien ataca primero segun la estadistica de Velocidad. En
              este caso, el Dark Wolf es mas rapido que Fede. <br/><br/>¡Preparate!
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleCloseIntroTutorial}
                className="cursor-pointer rounded-md border border-amber-700/80 bg-amber-800/80 px-5 py-2 font-semibold text-amber-100 transition hover:bg-amber-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {isSkillTutorialOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
          <div
            className={`${helpCardFont.className} w-full max-w-2xl rounded-xl border border-amber-800/70 bg-[#1a100c]/95 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] sm:p-6`}
          >
            <p className="text-center text-sm font-normal leading-relaxed text-amber-50/80 sm:text-base">
              Usar habilidades consume maná. <br /><br />Junto al nombre de la habilidad
              está detallado el consumo de Maná de la habilidad e información
              sobre esta.<br /><br /> Solo se pueden lanzar las habilidades si tu maná
              restante alcanza para hacerlo.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setIsSkillTutorialOpen(false)}
                className="cursor-pointer rounded-md border border-amber-700/80 bg-amber-800/80 px-5 py-2 font-semibold text-amber-100 transition hover:bg-amber-700"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {skillInfoTooltip.open && (
        <div
          className={`${helpCardFont.className} fixed z-[60] max-w-sm rounded-lg border border-sky-700/75 bg-[#0f1827]/96 px-3 py-2 text-sm leading-relaxed text-sky-100 shadow-[0_12px_30px_rgba(0,0,0,0.55)]`}
          style={{ left: skillInfoTooltip.x, top: skillInfoTooltip.y }}
        >
          <p className="font-bold">Golpe cargado (10 MP)</p>
          <div className="my-1 h-px w-full bg-sky-500/45" />
          <p>
            Fede lanza un golpe cargado que realiza al enemigo [{chargedHitDamage}] (ATK + 5 + 50% ATK)
          </p>
        </div>
      )}

      {isCombatFinished && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-4">
          {isVictory ? (
            <div className="w-full max-w-xl space-y-3">
              <div
                className={`${menuFont.className} rounded-xl border border-emerald-600/85 bg-emerald-950/90 px-6 py-5 text-center shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
              >
                <p className="text-2xl font-bold uppercase tracking-[0.14em] text-emerald-100 sm:text-3xl">
                  VICTORIA
                </p>
              </div>
              <div
                className={`${menuFont.className} rounded-xl border border-amber-700/70 bg-[#1c120e]/95 p-5 shadow-[0_14px_50px_rgba(0,0,0,0.55)] sm:p-6`}
              >
                <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/95">
                  Has Conseguido:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="mx-auto w-[8.5rem]">
                      <div className="relative flex h-[8.5rem] w-[8.5rem] items-center justify-center rounded-2xl border-2 border-[#5f6d85] bg-gradient-to-b from-[#8fa1bd] via-[#5d6f8d] to-[#3e4e68] p-[6px] shadow-[inset_0_1px_0_rgba(218,230,255,0.35),inset_0_-1px_0_rgba(16,26,45,0.55),0_10px_18px_rgba(0,0,0,0.35)]">
                        <div className="flex h-full w-full items-center justify-center rounded-xl border border-[#1a2539]/80 bg-[#101a2b]/92 p-2">
                          <Image
                            src={ICON_XP}
                            alt="XP"
                            width={112}
                            height={112}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <span className="absolute -bottom-1 -right-1 rounded-full border border-[#1f2d44] bg-[#0f1828]/95 px-2 py-0.5 text-xs font-black leading-none text-white shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
                          +10 XP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="mx-auto w-[8.5rem]">
                      <div className="relative flex h-[8.5rem] w-[8.5rem] items-center justify-center rounded-2xl border-2 border-[#5f6d85] bg-gradient-to-b from-[#8fa1bd] via-[#5d6f8d] to-[#3e4e68] p-[6px] shadow-[inset_0_1px_0_rgba(218,230,255,0.35),inset_0_-1px_0_rgba(16,26,45,0.55),0_10px_18px_rgba(0,0,0,0.35)]">
                        <div className="flex h-full w-full items-center justify-center rounded-xl border border-[#1a2539]/80 bg-[#101a2b]/92 p-2">
                          <Image
                            src={ICON_GOLD}
                            alt="Oro"
                            width={112}
                            height={112}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <span className="absolute -bottom-1 -right-1 rounded-full border border-[#1f2d44] bg-[#0f1828]/95 px-2 py-0.5 text-xs font-black leading-none text-white shadow-[0_2px_5px_rgba(0,0,0,0.5)]">
                          x5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleVictoryContinue()}
                  className="mt-6 w-full cursor-pointer rounded-md border border-amber-600/80 bg-amber-700/80 px-4 py-2 font-semibold text-amber-50 transition hover:bg-amber-600/90"
                >
                  CONTINUAR
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`${menuFont.className} w-full max-w-xl rounded-xl border border-amber-700/80 bg-[#1a100c]/95 px-6 py-8 text-center shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
            >
              <p className="text-2xl font-bold uppercase tracking-[0.14em] text-amber-100 sm:text-3xl">
                FINALIZA COMBATE
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
