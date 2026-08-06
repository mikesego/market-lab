import { csvResponse, toCsv } from "@/lib/csv";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export async function GET(_request: Request, { params }: RouteContext<"/teacher/games/[gameId]/exports/activity">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) return new Response("Not found", { status: 404 });
  const rows: Array<Array<string | number | null | undefined>> = [["Time", "Person", "Activity type", "Activity", "Details", "Symbol", "Status"]];
  for (const event of workspace.data.activity) rows.push([event.occurredAt.toISOString(), event.studentName, event.kind, event.title, event.detail, event.symbol, event.status]);
  return csvResponse(`${slug(workspace.game.name)}-activity.csv`, toCsv(rows));
}

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
