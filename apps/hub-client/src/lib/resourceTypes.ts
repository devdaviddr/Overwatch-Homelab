import type { ResourceType } from "@overwatch/shared-types";

export interface ResourceTypeConfig {
  label: string;
  description: string;
  iconName: "server" | "database" | "monitor";
  color: string; // tailwind text color
  bgColor: string; // tailwind bg color
  borderColor: string; // tailwind border color
}

export const RESOURCE_TYPE_CONFIG: Record<ResourceType, ResourceTypeConfig> = {
  HOMELAB: {
    label: "Homelab",
    description: "Multi-service home server setup",
    iconName: "server",
    color: "text-brand-400",
    bgColor: "bg-brand-900/40",
    borderColor: "border-brand-700",
  },
  SERVER: {
    label: "Server",
    description: "Dedicated server or rack unit",
    iconName: "database",
    color: "text-violet-400",
    bgColor: "bg-violet-900/40",
    borderColor: "border-violet-700",
  },
  PC: {
    label: "PC",
    description: "Personal computer or workstation",
    iconName: "monitor",
    color: "text-emerald-400",
    bgColor: "bg-emerald-900/40",
    borderColor: "border-emerald-700",
  },
};
