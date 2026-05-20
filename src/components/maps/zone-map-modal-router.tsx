import { InitialZoneMapModal } from "@/components/maps/initial-zone-map-modal";
import type { ComponentType } from "react";

type ZoneMapModalComponentProps = {
  restrictToCamp?: boolean;
  mapSrc?: string;
  isCampBuilt?: boolean;
  meloniFoundCave?: boolean;
  hasFortuneCookieInInventory?: boolean;
  meloniGalletaGiven?: boolean;
};

type ZoneMapModalRouterProps = {
  zoneId?: string;
  restrictToCamp?: boolean;
  mapSrc?: string;
  isCampBuilt?: boolean;
  meloniFoundCave?: boolean;
  hasFortuneCookieInInventory?: boolean;
  meloniGalletaGiven?: boolean;
};

const zoneMapModalRegistry: Record<string, ComponentType<ZoneMapModalComponentProps>> = {
  initial_zone: InitialZoneMapModal,
};

export function ZoneMapModalRouter({
  zoneId,
  restrictToCamp = false,
  mapSrc,
  isCampBuilt = false,
  meloniFoundCave = false,
  hasFortuneCookieInInventory = false,
  meloniGalletaGiven = false,
}: ZoneMapModalRouterProps) {
  const normalizedZoneId = (zoneId ?? "initial_zone").trim().toLowerCase();
  const ZoneMapModal = zoneMapModalRegistry[normalizedZoneId] ?? InitialZoneMapModal;

  return (
    <ZoneMapModal
      restrictToCamp={restrictToCamp}
      mapSrc={mapSrc}
      isCampBuilt={isCampBuilt}
      meloniFoundCave={meloniFoundCave}
      hasFortuneCookieInInventory={hasFortuneCookieInInventory}
      meloniGalletaGiven={meloniGalletaGiven}
    />
  );
}
