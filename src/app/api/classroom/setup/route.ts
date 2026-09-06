import { classroomBody, classroomFailure, classroomResponse, deviceSchema, setupDevice } from "@/lib/classroom/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try { return classroomResponse(await setupDevice(deviceSchema.parse(await classroomBody(request)))); }
  catch (error) { return classroomFailure(error); }
}
