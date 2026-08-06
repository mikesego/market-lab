import "server-only";

import { cache } from "react";

import { requireTeacher } from "@/lib/auth/teacher";
import { getOwnedTeacherGame, getTeacherGameDTOById } from "@/lib/data/teacher";

export const getTeacherWorkspace = cache(async (gameId: string) => {
  const teacher = await requireTeacher();
  const owned = await getOwnedTeacherGame(gameId, teacher.adult.id);
  if (!owned) return null;
  const data = await getTeacherGameDTOById(gameId);
  if (!data) return null;
  return { ...teacher, ...owned, data };
});
