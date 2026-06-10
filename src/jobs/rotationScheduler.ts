import { prisma } from "../db/index.js";
import { createNextCycle } from "../services/rotationEngine.js";
import { createDirectNotification } from "../services/notification.service.js";

export async function runRotationScheduler(jobId: string) {
  let cyclesCreated = 0;
  let notificationsSent = 0;
  let errors = [];

  try {
    const now = new Date();

    // 1. Detect overdue cycles
    const overdueCycles = await prisma.rotationCycle.findMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now },
      },
      include: {
        rotation: true,
      },
    });

    for (const cycle of overdueCycles) {
      try {
        await prisma.rotationCycle.update({
          where: { id: cycle.id },
          data: { status: "OVERDUE" },
        });

        // Notify assigned member
        await createDirectNotification(
          cycle.assignedTo,
          cycle.rotation.flatId,
          "ROTATION_OVERDUE" as any,
          "Rotation Overdue",
          `Your assignment for ${cycle.rotation.name} is overdue.`
        );
        notificationsSent++;

        // Notify flat admin
        const adminMemberships = await prisma.membership.findMany({
          where: { flatId: cycle.rotation.flatId, role: "ADMIN" },
        });
        
        for (const admin of adminMemberships) {
          if (admin.userId !== cycle.assignedTo) {
            await createDirectNotification(
              admin.userId,
              cycle.rotation.flatId,
              "ROTATION_OVERDUE" as any,
              "Rotation Overdue",
              `A rotation cycle for ${cycle.rotation.name} is overdue.`
            );
            notificationsSent++;
          }
        }
      } catch (err: any) {
        errors.push(`Error marking cycle ${cycle.id} overdue: ${err.message}`);
      }
    }

    // 2. Generate due cycles for active rotations without pending cycles
    const activeRotations = await prisma.rotation.findMany({
      where: { 
        isActive: true,
        frequency: { not: "ON_DEMAND" } 
      },
      include: {
        cycles: {
          where: { status: "PENDING" },
          take: 1,
        },
      },
    });

    for (const rotation of activeRotations) {
      if (rotation.cycles.length === 0) {
        // No pending cycle exists, try to generate one
        try {
          await createNextCycle(rotation.id);
          cyclesCreated++;
          notificationsSent++; // Assignee notified in engine
        } catch (err: any) {
          if (err.message.includes("requires at least 2 active members")) {
            // Silently ignore rotations without enough members
            continue;
          }
          errors.push(`Error creating cycle for rotation ${rotation.id}: ${err.message}`);
        }
      }
    }

  } catch (err: any) {
    errors.push(`Critical rotation scheduler error: ${err.message}`);
  }

  return { cyclesCreated, notificationsSent, errors };
}
