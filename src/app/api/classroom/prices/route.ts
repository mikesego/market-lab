import { z } from "zod";
import { authenticateDevice, classroomBody, classroomFailure, classroomResponse, createPricePack } from "@/lib/classroom/server";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = z.object({ deviceId: z.string().uuid(), symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9.-]{0,14}$/)).max(10).default([]) }).parse(await classroomBody(request));
    return classroomResponse(await createPricePack(await authenticateDevice(request, input.deviceId), input.symbols));
  } catch (error) { return classroomFailure(error); }
}
