export function getEnabledLessonIds(config: Record<string, unknown>, allLessonIds: string[]) {
  const configured = config.enabledLessonIds;
  if (!Array.isArray(configured)) return new Set(allLessonIds);
  return new Set(configured.filter((value): value is string => typeof value === "string"));
}
