import { db } from "@/server/db";

export async function platformFlag(key: "CAMPAIGNS_ENABLED" | "MANUAL_ATTRIBUTION_ENABLED" | "NEW_PROJECTS_ENABLED", fallback = true) {
  const setting = await db.platformSetting.findUnique({ where: { key }, select: { value: true } });
  return typeof setting?.value === "boolean" ? setting.value : fallback;
}
