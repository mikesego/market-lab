import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, classroomDevices, portfolios } from "@/db/schema";
import { hashSessionToken } from "@/lib/security/student-credentials";
import { ClassroomError, classroomBody, classroomFailure, classroomResponse } from "@/lib/classroom/server";
export async function POST(request: Request) {
  try {
    const input = z.object({ deviceId: z.string().uuid(), lastSequence: z.number().int().nonnegative() }).parse(await classroomBody(request));
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ClassroomError("Device access required.", 401);
    const [device] = await db.select().from(classroomDevices).where(and(eq(classroomDevices.id, input.deviceId), eq(classroomDevices.tokenHash, hashSessionToken(token))));
    if (!device) throw new ClassroomError("Device access required.", 401);
    await db.transaction(async (tx) => {
      const [portfolio] = await tx.select().from(portfolios).where(eq(portfolios.id, device.portfolioId)).for("update");
      const [current] = await tx.select().from(classroomDevices).where(eq(classroomDevices.id, device.id)).for("update");
      if (!current.active) return; // Safe retry after a lost release response.
      if (current.lastSequence !== input.lastSequence) throw new ClassroomError("Sync every trade before releasing this device.");
      await tx.update(classroomDevices).set({ active: false }).where(eq(classroomDevices.id, device.id));
      await tx.insert(auditEvents).values({ actorType: "student", actorId: portfolio.studentId, action: "classroom_device_released", targetType: "classroom_device", targetId: device.id, gameId: portfolio.gameId });
    });
    return classroomResponse({ released: true });
  } catch (error) { return classroomFailure(error); }
}
