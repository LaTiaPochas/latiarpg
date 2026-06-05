"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { buildMemberFaceSrc } from "@/lib/biblioteca-user-stats";

const MEMBER_FACE_FALLBACK_SRC = "/img/resources/logos/logo_latia_rpg.png";

type BibliotecaMemberFaceIconProps = {
  miembro: string;
  faceSrc?: string;
  className?: string;
};

function resolveMemberFaceSrc(miembro: string, faceSrc?: string): string {
  if (typeof faceSrc === "string" && faceSrc.trim().startsWith("/")) {
    return faceSrc.trim();
  }
  const miembroKey = miembro.trim().toLowerCase();
  if (!miembroKey || miembroKey === "sin nombre") {
    return MEMBER_FACE_FALLBACK_SRC;
  }
  return buildMemberFaceSrc(miembroKey);
}

export function BibliotecaMemberFaceIcon({
  miembro,
  faceSrc,
  className = "mx-auto h-9 w-9 rounded-full border border-[#7a5c31]/50 object-cover shadow-sm sm:h-10 sm:w-10",
}: BibliotecaMemberFaceIconProps) {
  const resolvedSrc = resolveMemberFaceSrc(miembro, faceSrc);
  const [imgSrc, setImgSrc] = useState(resolvedSrc);

  useEffect(() => {
    setImgSrc(resolveMemberFaceSrc(miembro, faceSrc));
  }, [faceSrc, miembro]);

  if (!imgSrc) {
    return null;
  }

  return (
    <Image
      src={imgSrc}
      alt={miembro}
      title={miembro}
      width={40}
      height={40}
      className={className}
      onError={() => {
        if (imgSrc !== MEMBER_FACE_FALLBACK_SRC) {
          setImgSrc(MEMBER_FACE_FALLBACK_SRC);
        }
      }}
    />
  );
}
