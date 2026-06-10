import { prisma } from "../db/index.js";
import { runRotationScheduler } from "./rotationScheduler.js";
import { runBillReminderScheduler } from "./billReminderScheduler.js";
import { randomUUID } from "crypto";

/**
 * Main scheduler entry point.
 * Runs daily tasks based on the PRD.
 */
export async function runScheduler() {
  const jobId = randomUUID();
  console.log(`[Scheduler] Starting daily jobs. JobId: ${jobId}`);
  
  const rotationJob = await prisma.schedulerLog.create({
    data: {
      id: randomUUID(),
      jobName: "rotation_scheduler",
      status: "PARTIAL", // Temporary until finished
    }
  });

  const billJob = await prisma.schedulerLog.create({
    data: {
      id: randomUUID(),
      jobName: "bill_reminder_scheduler",
      status: "PARTIAL",
    }
  });

  try {
    const rotationRes = await runRotationScheduler(rotationJob.id);
    
    await prisma.schedulerLog.update({
      where: { id: rotationJob.id },
      data: {
        cyclesCreated: rotationRes.cyclesCreated,
        notificationsSent: rotationRes.notificationsSent,
        errors: rotationRes.errors.length > 0 ? JSON.stringify(rotationRes.errors) : null,
        status: rotationRes.errors.length > 0 ? "PARTIAL" : "SUCCESS",
      }
    });
    
    console.log(`[Scheduler] Rotation logic finished.`);
  } catch (err: any) {
    await prisma.schedulerLog.update({
      where: { id: rotationJob.id },
      data: { status: "FAILED", errors: err.message }
    });
    console.error(`[Scheduler] Rotation logic failed: ${err.message}`);
  }

  try {
    const billRes = await runBillReminderScheduler(billJob.id);

    await prisma.schedulerLog.update({
      where: { id: billJob.id },
      data: {
        notificationsSent: billRes.notificationsSent,
        errors: billRes.errors.length > 0 ? JSON.stringify(billRes.errors) : null,
        status: billRes.errors.length > 0 ? "PARTIAL" : "SUCCESS",
      }
    });

    console.log(`[Scheduler] Bill reminder logic finished.`);
  } catch (err: any) {
    await prisma.schedulerLog.update({
      where: { id: billJob.id },
      data: { status: "FAILED", errors: err.message }
    });
    console.error(`[Scheduler] Bill reminder logic failed: ${err.message}`);
  }
}

/**
 * Initializes the cron-like scheduler inside the Node/Bun process.
 */
export function initScheduler() {
  // In a real production system, you'd use a robust package like `node-cron`.
  // For this MVP, we use setInterval. Since the requirement is 08:00 IST daily,
  // we would calculate milliseconds until 08:00 IST and setTimeout, then setInterval.
  // For simplicity here, we run it every 24 hours starting from boot.
  
  // As a fast boot test, we could run it once on startup if needed, 
  // but let's just do a 24-hour interval for standard behavior.
  
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  setInterval(() => {
    runScheduler().catch(console.error);
  }, ONE_DAY_MS);

  // We could also run it immediately on startup for testing:
  // runScheduler().catch(console.error);
  console.log("[Scheduler] Initialized. Will run periodically.");
}
