/**
 * Cohably V2 Notification System Tests
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let flatId: string;
let chaitanyaId: string;
let rahulId: string;

beforeAll(async () => {
  // Create test users
  const suffix = Math.random().toString(36).substring(7);
  const chaitanya = await prisma.user.create({
    data: { name: "Chaitanya N", email: `chaitanya.notif.${suffix}@example.com`, passwordHash: "test" },
  });
  const rahul = await prisma.user.create({
    data: { name: "Rahul N", email: `rahul.notif.${suffix}@example.com`, passwordHash: "test" },
  });

  chaitanyaId = chaitanya.id;
  rahulId = rahul.id;

  // Create flat
  const flat = await prisma.flat.create({
    data: { name: "Notif Flat", inviteCode: "NTF123", createdBy: chaitanyaId },
  });
  flatId = flat.id;

  // Add memberships
  for (const userId of [chaitanyaId, rahulId]) {
    await prisma.membership.create({
      data: { flatId, userId, role: userId === chaitanyaId ? "ADMIN" : "MEMBER" },
    });
  }
});

afterAll(async () => {
  // Clean up test data
  await prisma.notification.deleteMany({ where: { flatId } });
  await prisma.split.deleteMany({ where: { expense: { flatId } } });
  await prisma.expense.deleteMany({ where: { flatId } });
  await prisma.membership.deleteMany({ where: { flatId } });
  await prisma.flat.delete({ where: { id: flatId } });
  await prisma.user.deleteMany({
    where: { id: { in: [chaitanyaId, rahulId] } },
  });
  await prisma.$disconnect();
});

// Import services
const { addExpense } = await import("../src/services/expense.service.js");
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = await import("../src/services/notification.service.js");

describe("Notification System", () => {
  let notificationId: string;

  it("Trigger: Expense Added creates notifications for others", async () => {
    // Chaitanya adds an expense
    await addExpense(flatId, chaitanyaId, "Groceries", 500, "FOOD", "EQUAL", [chaitanyaId, rahulId]);

    console.log("Expense Added successfully");

    // Give it a tiny bit of time just in case
    await new Promise((r) => setTimeout(r, 100));

    // Rahul should have 1 notification
    const rahulNotifs = await getNotifications(rahulId, 1, 10);
    console.log("Rahul Notifs:", rahulNotifs);
    
    expect(rahulNotifs.notifications.length).toBeGreaterThan(0);
    expect(rahulNotifs.notifications[0]!.type).toBe("EXPENSE_ADDED");
    expect(rahulNotifs.notifications[0]!.message).toContain("Chaitanya N added");

    notificationId = rahulNotifs.notifications[0]!.id;

    // Chaitanya should have 0 notifications (actor doesn't get notified)
    const chaitanyaNotifs = await getNotifications(chaitanyaId, 1, 10);
    expect(chaitanyaNotifs.notifications.length).toBe(0);
  });

  it("getUnreadCount returns correct count", async () => {
    const res = await getUnreadCount(rahulId);
    expect(res.count).toBe(1);
  });

  it("markAsRead marks a specific notification as read", async () => {
    await markAsRead(notificationId, rahulId);

    const res = await getUnreadCount(rahulId);
    expect(res.count).toBe(0); // Should be 0 now
  });

  it("markAllAsRead marks all remaining as read", async () => {
    // Manually insert an unread notification
    await prisma.notification.create({
      data: {
        userId: rahulId,
        flatId,
        type: "MEMBER_JOINED",
        title: "Test",
        message: "Test message",
      },
    });

    let res = await getUnreadCount(rahulId);
    expect(res.count).toBe(1);

    await markAllAsRead(rahulId);

    res = await getUnreadCount(rahulId);
    expect(res.count).toBe(0);
  });
});
