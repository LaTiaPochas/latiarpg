import { NearWoodsGatherActions } from "@/components/near-woods/near-woods-gather-actions";
import { Montserrat } from "next/font/google";

const uiFont = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

/** Altura útil bajo `TopNav`: `(main)` del layout aplica `pt-14` para el header fijo. */
const BELOW_NAV = "h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden";

export default function NearWoodsPage() {
  return (
    <div className={`${uiFont.className} relative flex w-full shrink-0 flex-col ${BELOW_NAV}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/img/resources/background/bg_near_woods.png')",
        }}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3 sm:px-5 sm:py-4">
        <section className="flex max-h-full min-h-0 w-full max-w-2xl flex-col justify-center overflow-hidden rounded-xl border border-amber-700/70 bg-[#1a100c]/90 p-4 text-center shadow-[0_18px_45px_rgba(0,0,0,0.45)] sm:p-5">
          <h1 className="text-xl font-bold uppercase tracking-wide text-amber-100 sm:text-2xl">
            Cercanías del Bosque
          </h1>
          <p className="mt-2 text-xs italic text-amber-200 lg:text-sm">
            - &quot;Whatever you do, don&apos;t leave the path!&quot;
          </p>
          <p className="mt-8 text-[11px] leading-snug text-amber-100/95 sm:mt-8 sm:text-[13px] sm:leading-relaxed lg:text-base">
            Estás buscando una forma sencilla de juntar recursos sin exponerte a los peligros del sendero
            como algunos de tus compañeros. <br /> Cada ramita que juntes, trae consigo la posibilidad de
            alertar enemigos que están escondidos esperando para atacarte. <br />
            ¿Qué es mejor? ¿Malo conocido o bueno por conocer?
          </p>
          <p className="mt-8 text-[11px] leading-snug text-amber-200/90 sm:mt-8 sm:text-[13px] sm:leading-relaxed lg:text-base">
            (Cuando te adentres en el bosque a juntar madera simplemente vas a tener una chance grande de
            obtener loot, pero una chance pequeña de ser atacado. El loot es bajo, pero las probabilidades
            están a tu favor.)
          </p>
          <NearWoodsGatherActions />
        </section>
      </div>
    </div>
  );
}
