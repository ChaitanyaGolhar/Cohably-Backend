import { prisma } from "../db/index.js";
import { createDirectNotification } from "../services/notification.service.js";

export async function runBillReminderScheduler(jobId: string) {
  let notificationsSent = 0;
  let errors = [];

  try {
    const now = new Date();
    // Normalize to start of day for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeReminders = await prisma.billReminder.findMany({
      where: { isActive: true },
      include: { flat: true }
    });

    for (const reminder of activeReminders) {
      try {
        const nextDue = new Date(reminder.nextDueDate);
        // Date reminder triggers
        const triggerDate = new Date(nextDue);
        triggerDate.setDate(triggerDate.getDate() - reminder.remindDaysBefore);

        // Check 1: Initial reminder X days before
        if (today >= triggerDate && (!reminder.lastTriggeredAt || reminder.lastTriggeredAt < triggerDate)) {
          await notifyBill(reminder, "BILL_REMINDER_DUE", `Bill Reminder: ${reminder.title}`, `Upcoming bill due on ${nextDue.toLocaleDateString()}`);
          notificationsSent++;
          
          await prisma.billReminder.update({
            where: { id: reminder.id },
            data: { lastTriggeredAt: now }
          });
          continue;
        }

        // Check 2: Day-of check
        const dayOfTrigger = new Date(nextDue);
        const dayOfLastTriggered = reminder.lastTriggeredAt ? new Date(reminder.lastTriggeredAt) : null;
        const wasTriggeredToday = dayOfLastTriggered && dayOfLastTriggered.getDate() === today.getDate() && dayOfLastTriggered.getMonth() === today.getMonth() && dayOfLastTriggered.getFullYear() === today.getFullYear();
        
        if (today.getTime() === nextDue.getTime() && !wasTriggeredToday) {
          await notifyBill(reminder, "BILL_REMINDER_DUE", `[Bill] ${reminder.title} is due TODAY`, `Please pay this bill today.`);
          notificationsSent++;

          await prisma.billReminder.update({
            where: { id: reminder.id },
            data: { lastTriggeredAt: now }
          });
          continue;
        }

        // Check 3: Overdue check
        if (today > nextDue && !wasTriggeredToday) {
          // Send to admin only
          const admins = await prisma.membership.findMany({
            where: { flatId: reminder.flatId, role: "ADMIN" }
          });
          for (const admin of admins) {
            await createDirectNotification(
              admin.userId,
              reminder.flatId,
              "BILL_REMINDER_OVERDUE" as any,
              `Overdue Bill: ${reminder.title}`,
              `The bill ${reminder.title} is past its due date.`
            );
            notificationsSent++;
          }
          await prisma.billReminder.update({
            where: { id: reminder.id },
            data: { lastTriggeredAt: now }
          });
        }
      } catch (err: any) {
        errors.push(`Error processing bill reminder ${reminder.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Critical bill reminder scheduler error: ${err.message}`);
  }

  return { notificationsSent, errors };
}

async function notifyBill(reminder: any, type: string, title: string, message: string) {
  if (reminder.responsibleMember) {
    await createDirectNotification(reminder.responsibleMember, reminder.flatId, type as any, title, message);
  } else {
    const members = await prisma.membership.findMany({
      where: { flatId: reminder.flatId, isActive: true }
    });
    for (const member of members) {
      await createDirectNotification(member.userId, reminder.flatId, type as any, title, message);
    }
  }
}
