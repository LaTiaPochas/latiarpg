"use client";

import Image from "next/image";
import { Montserrat } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { completeClassSelection, selectClass } from "@/app/class-selection/actions";

const BG_INTRO_FOREST = "/img/resources/background/bg_intro_forest.png";

const menuFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

type GameClass = {
  id: string;
  name: string;
  description: string;
  str: number;
  dex: number;
  int: number;
  wis: number;
};

type ClassSelectionScreenProps = {
  classes: GameClass[];
};

export function ClassSelectionScreen({ classes }: ClassSelectionScreenProps) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHelloModalOpen, setIsHelloModalOpen] = useState(false);
  const [isWorldPreparing, setIsWorldPreparing] = useState(false);
  const [preparationProgress, setPreparationProgress] = useState(0);
  const [preparationMessage, setPreparationMessage] = useState("Preparando el mundo");
  const [isPending, startTransition] = useTransition();

  const onSelectClass = () => {
    if (!selectedClassId || isPending || isConfirmModalOpen) return;
    setIsConfirmModalOpen(true);
  };

  const onConfirmSelectClass = () => {
    if (!selectedClassId || isPending) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await selectClass(selectedClassId);
      if (!result.ok) {
        setErrorMessage(result.error ?? "No se pudo seleccionar la clase.");
        setIsConfirmModalOpen(false);
        return;
      }
      setIsConfirmModalOpen(false);
      setIsHelloModalOpen(true);
    });
  };

  const buildClassIconSrc = (className: string) => {
    const normalizedName = className
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_");
    return `/img/resources/iconos/icon_class_${normalizedName}.png`;
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const onStartAdventure = () => {
    if (isPending || isWorldPreparing) return;
    setErrorMessage(null);
    setIsWorldPreparing(true);
    setPreparationMessage("Preparando el mundo");
    setPreparationProgress(0);

    const totalMs = 5000;
    const intervalMs = 50;
    const step = 100 / (totalMs / intervalMs);
    const progressInterval = window.setInterval(() => {
      setPreparationProgress((prev) => Math.min(prev + step, 99));
    }, intervalMs);

    startTransition(async () => {
      const [completeResult] = await Promise.all([completeClassSelection(), wait(totalMs)]);
      window.clearInterval(progressInterval);

      if (!completeResult.ok) {
        setIsWorldPreparing(false);
        setErrorMessage(completeResult.error ?? "No se pudo completar el tutorial.");
        return;
      }

      setPreparationProgress(100);
      setPreparationMessage("¡Todo listo!");
      await wait(1000);
      router.push("/");
    });
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#120b08] text-amber-50">
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

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-10">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {classes.map((gameClass, index) => {
            const isSelected = selectedClassId === gameClass.id;
            return (
              <button
                key={gameClass.id}
                type="button"
                onClick={() => setSelectedClassId(gameClass.id)}
                className={`${menuFont.className} flex h-full min-h-52 cursor-pointer flex-col rounded-xl border p-6 text-center text-xl font-semibold transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-900/45 shadow-[0_0_0_2px_rgba(251,191,36,0.55)]"
                    : "border-amber-800/70 bg-[#1a100c]/88 hover:border-amber-600/80 hover:bg-[#24150f]/92"
                }`}
              >
                <div className="mb-3 flex justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-amber-700/70 bg-black/30 p-2 shadow-[0_6px_16px_rgba(0,0,0,0.35)]">
                    <Image
                      src={buildClassIconSrc(gameClass.name || `modal_${index + 1}`)}
                      alt={`Icono de ${gameClass.name || `Modal ${index + 1}`}`}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] object-contain"
                    />
                  </div>
                </div>
                <div className="-mx-6 flex min-h-[2.5rem] items-center justify-center border-y border-amber-700/70 bg-black/20 px-4 py-1.5 text-center">
                  <p>{gameClass.name || `Modal ${index + 1}`}</p>
                </div>
                <div className="mt-3 flex h-[5rem] flex-col">
                  <p className="text-xs font-normal leading-relaxed text-amber-100/80">
                    {gameClass.description || `Descripcion de ${gameClass.name || `Modal ${index + 1}`}`}
                  </p>
                  <div className="mt-auto flex justify-center pt-2">
                    <div className="h-px w-28 bg-gradient-to-r from-transparent via-amber-700/75 to-transparent" />
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-md border border-amber-700/70 bg-black/25 px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-wider text-amber-200/80">
                      STR
                    </span>
                    <span className="mt-0.5 block text-base font-semibold leading-none text-amber-100">
                      {gameClass.str}
                    </span>
                  </p>
                  <p className="rounded-md border border-amber-700/70 bg-black/25 px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-wider text-amber-200/80">
                      DEX
                    </span>
                    <span className="mt-0.5 block text-base font-semibold leading-none text-amber-100">
                      {gameClass.dex}
                    </span>
                  </p>
                  <p className="rounded-md border border-amber-700/70 bg-black/25 px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-wider text-amber-200/80">
                      INT
                    </span>
                    <span className="mt-0.5 block text-base font-semibold leading-none text-amber-100">
                      {gameClass.int}
                    </span>
                  </p>
                  <p className="rounded-md border border-amber-700/70 bg-black/25 px-2 py-1">
                    <span className="block text-[10px] uppercase tracking-wider text-amber-200/80">
                      WIS
                    </span>
                    <span className="mt-0.5 block text-base font-semibold leading-none text-amber-100">
                      {gameClass.wis}
                    </span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onSelectClass}
          disabled={selectedClassId === null || isPending || isConfirmModalOpen}
          className={`${menuFont.className} relative overflow-hidden rounded-lg border px-8 py-3 text-base font-bold uppercase tracking-[0.14em] transition-all duration-300 ${
            selectedClassId === null || isPending || isConfirmModalOpen
              ? "cursor-not-allowed border-amber-900/70 bg-amber-950/55 text-amber-200/45"
              : "cursor-pointer border-amber-600/80 bg-gradient-to-b from-[#c47b2a] via-[#9f5a20] to-[#6f3617] text-amber-50 shadow-[0_10px_24px_rgba(120,58,22,0.45),inset_0_1px_0_rgba(255,224,185,0.28)] hover:-translate-y-0.5 hover:from-[#d08a33] hover:via-[#ad6526] hover:to-[#7b3f1b] hover:shadow-[0_14px_30px_rgba(120,58,22,0.6),inset_0_1px_0_rgba(255,232,199,0.4)] active:translate-y-0 active:scale-[0.99]"
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-0 ${
              selectedClassId === null || isPending || isConfirmModalOpen
                ? ""
                : "bg-[radial-gradient(circle_at_50%_-20%,rgba(255,224,185,0.25),transparent_58%)]"
            }`}
            aria-hidden
          />
          <span className="relative">{isPending ? "Guardando..." : "Seleccionar"}</span>
        </button>
        {errorMessage && (
          <p className="text-sm font-medium text-red-200">{errorMessage}</p>
        )}
      </section>
      {isConfirmModalOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`${menuFont.className} w-full max-w-lg rounded-xl border border-amber-700/80 bg-[#1c120e]/95 p-6 text-center shadow-[0_14px_40px_rgba(0,0,0,0.55)]`}
          >
            <p className="text-lg font-semibold text-amber-100">
              ¿Estás seguro que querés seleccionar esta clase?
            </p>
            <p className="mt-3 text-sm text-red-300">Esta decisión es irreversible.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onConfirmSelectClass}
                disabled={isPending}
                className="cursor-pointer rounded-md border border-amber-600/80 bg-amber-700/80 px-5 py-2 font-semibold text-amber-50 transition hover:bg-amber-600/90 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isPending ? "Guardando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isPending}
                className="cursor-pointer rounded-md border border-amber-800/80 bg-amber-950/45 px-5 py-2 font-semibold text-amber-100 transition hover:bg-amber-900/65 disabled:cursor-not-allowed disabled:opacity-65"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {isHelloModalOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`${menuFont.className} w-full max-w-3xl rounded-xl border border-amber-700/80 bg-[#1c120e]/95 p-6 text-center shadow-[0_14px_40px_rgba(0,0,0,0.55)] sm:p-8`}
          >
            <div className="mx-auto flex w-full max-w-sm justify-center">
              <Image
                src="/img/resources/logos/logo_latia_rpg.png"
                alt="Logo La Tia RPG"
                width={420}
                height={140}
                className="w-full object-contain"
                style={{ height: "auto" }}
                priority
              />
            </div>

            <div className="my-5 flex justify-center">
              <div className="h-px w-3/4 bg-gradient-to-r from-transparent via-amber-700/80 to-transparent" />
            </div>

            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-amber-100/90 sm:text-base">
              ¡Bienvenido al mundo de La Tia RPG!
              <br />
              <br />
              Este es un juego donde vas a vivir en la piel de tu personaje de La Tia
              Pochas, para formar una comunidad y tratar de sobrevivir en este mundo
              hostil que creó Mati.
              <br />
              <br />
              Vas a tener que equiparte, desarrollar mejoras para el grupo de forma
              colaborativa y pelear contra los peligros del mundo fantasioso en que te
              encontrás, para poder buscar la salida.
              <br />
              <br />
              En el transcurso, vas a sumar puntos para utilizar en los Awards, claro
              está.
              <br />
              <br />
              ¿Qué esperás? Vamos a empezar tu camino a leyenda.
            </p>

            <div className="my-5 flex justify-center">
              <div className="h-px w-3/4 bg-gradient-to-r from-transparent via-amber-700/80 to-transparent" />
            </div>

            <button
              type="button"
              onClick={onStartAdventure}
              disabled={isPending || isWorldPreparing}
              className="cursor-pointer rounded-md border border-amber-600/80 bg-gradient-to-b from-[#c47b2a] via-[#9f5a20] to-[#6f3617] px-8 py-3 text-base font-bold uppercase tracking-[0.12em] text-amber-50 shadow-[0_10px_24px_rgba(120,58,22,0.45),inset_0_1px_0_rgba(255,224,185,0.28)] transition hover:-translate-y-0.5 hover:from-[#d08a33] hover:via-[#ad6526] hover:to-[#7b3f1b] hover:shadow-[0_14px_30px_rgba(120,58,22,0.6),inset_0_1px_0_rgba(255,232,199,0.4)] active:translate-y-0 active:scale-[0.99]"
            >
              Empezar mi Aventura
            </button>
          </div>
        </div>
      )}
      {isWorldPreparing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className={`${menuFont.className} w-full max-w-xl text-center`}>
            <p className="mb-5 text-lg font-semibold uppercase tracking-[0.1em] text-amber-100">
              {preparationMessage}
            </p>
            <div className="h-5 w-full overflow-hidden rounded-full border border-amber-600/80 bg-[#1a100c]/90 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)]">
              <div
                className="h-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 transition-[width] duration-75"
                style={{ width: `${preparationProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
