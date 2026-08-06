import { csvResponse, toCsv } from "@/lib/csv";
import { getTeacherWorkspace } from "@/lib/data/teacher-workspace";

export async function GET(_request: Request, { params }: RouteContext<"/teacher/games/[gameId]/exports/report">) {
  const { gameId } = await params;
  const workspace = await getTeacherWorkspace(gameId);
  if (!workspace) return new Response("Not found", { status: 404 });
  const submissionsByStudent = new Map<string, number>();
  for (const submission of workspace.data.submissions) submissionsByStudent.set(submission.studentId, (submissionsByStudent.get(submission.studentId) ?? 0) + 1);
  const rows: Array<Array<string | number | null | undefined>> = [["Student", "Financial rank", "Portfolio value", "Return percent", "Labs complete", "Available labs", "Journal entries", "Assignments submitted", "Assignments assigned", "Last active"]];
  for (const student of workspace.data.roster.slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))) rows.push([student.displayName, student.rank, student.equity.toFixed(2), student.returnPercent.toFixed(2), student.lessonsCompleted, workspace.data.activeLessons.length, student.journalCount, submissionsByStudent.get(student.id) ?? 0, workspace.data.assignments.length, student.lastSeenAt?.toISOString()]);
  return csvResponse(`${slug(workspace.game.name)}-report.csv`, toCsv(rows));
}

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
