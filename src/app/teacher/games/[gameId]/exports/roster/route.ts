import { csvResponse, toCsv } from "@/lib/csv";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export async function GET(_request: Request, { params }: RouteContext<"/teacher/games/[gameId]/exports/roster">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) return new Response("Not found", { status: 404 });
  const rows: Array<Array<string | number | null | undefined>> = [["Display name", "Username", "Status", "Portfolio value", "Return percent", "Lessons complete", "Journal entries", "Last active"]];
  for (const student of workspace.data.roster) rows.push([student.displayName, student.username, student.status, student.equity.toFixed(2), student.returnPercent.toFixed(2), student.lessonsCompleted, student.journalCount, student.lastSeenAt?.toISOString()]);
  return csvResponse(`${slug(workspace.game.name)}-roster.csv`, toCsv(rows));
}

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
