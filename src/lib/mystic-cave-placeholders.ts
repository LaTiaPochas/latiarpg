/** Pool de diálogos en `/mystic-cave`: se muestra uno al azar al entrar a la página. */
export type MysticCavePlaceholderDialogue = {
  /** Opcional; si falta, se infiere del nombre del archivo del retrato. */
  speaker?: string;
  faceSrc: string;
  text: string;
};

export function mysticCaveDialoguePortraitAlt(
  faceSrc: string,
  speaker?: string,
): string {
  const fromSpeaker = speaker?.trim();
  if (fromSpeaker) {
    return `Retrato de ${fromSpeaker}`;
  }

  const faceMatch = faceSrc.match(/pj_([a-z0-9]+)_rpg_face/i);
  if (faceMatch?.[1]) {
    const name = faceMatch[1];
    return `Retrato de ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }

  if (faceSrc.includes("neutral_events")) {
    return "Eventos del mundo";
  }

  return "Retrato del personaje";
}

export const MYSTIC_CAVE_PLACEHOLDER_DIALOGUES: MysticCavePlaceholderDialogue[] = [
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    text: "¿Qué clase de criaturas habitarán estos túneles?",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    text: "This is no mine. It's a tomb!",
  },
  {
    faceSrc: "/img/resources/other_faces/neutral_events.png",
    text: "The dwarves delved too greedily and too deep. You know what they awoke in the darkness of Khazad-dûm... shadow and flame.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_becho_rpg_face.png",
    text: "Ahhh estas son las gocas que decía Silva.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_silva_rpg_face.png",
    text: "Creo haber escuchado a Bece decir que entramos adentro de la cueva. Hmmm... Como si se pudiera entrar afuera.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_nacho_rpg_face.png",
    text: "Estas no eran las piedras que estaba buscando.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_fede_rpg_face.png",
    text: "Parece tan lejana la fugazzeta rellena que me clavé antes de venir acá.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_checho_rpg_face.png",
    text: "PIIIIIII (piiiiiii) ROOOOOOO (rooooooo) KAAAAAAAAAAAAA (kaaaaaaaaaaa). Hay un buen eco acá adentro.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_mati_rpg_face.png",
    text: "Esta cueva no estaba así...",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_delu_rpg_face.png",
    text: "Que tuneles increibles...",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_delu_rpg_face.png",
    text: "Vení chanchita, acá tenés una banda de piedras.",
  },
  {
    faceSrc: "/img/resources/caracters_faces/pj_silva_rpg_face.png",
    text: "Hoy jugaba el Chelsea... ¿Cómo habrá salido?",
  },
];
