import { authenticateDevice, classroomBody, classroomFailure, classroomResponse, syncDevice, syncSchema } from "@/lib/classroom/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = syncSchema.parse(await classroomBody(request));
    return classroomResponse(await syncDevice(await authenticateDevice(request, input.deviceId), input));
  } catch (error) { return classroomFailure(error); }
}
