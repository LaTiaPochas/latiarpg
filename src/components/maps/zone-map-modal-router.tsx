import { InitialZoneMapModal } from "@/components/maps/initial-zone-map-modal";
import type { ComponentType } from "react";

type ZoneMapModalComponentProps = {
  restrictToCamp?: boolean;
};

type ZoneMapModalRouterProps = {
  zoneId?: string;
  restrictToCamp?: boolean;
};

const zoneMapModalRegistry: Record<string, ComponentType<ZoneMapModalComponentProps>> = {
  initial_zone: InitialZoneMapModal,
};

export function ZoneMapModalRouter({ zoneId, restrictToCamp = false }: ZoneMapModalRouterProps) {
  const normalizedZoneId = (zoneId ?? "initial_zone").trim().toLowerCase();
  const ZoneMapModal = zoneMapModalRegistry[normalizedZoneId] ?? InitialZoneMapModal;

  return <ZoneMapModal restrictToCamp={restrictToCamp} />;
}
