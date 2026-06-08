/**
 * Cohably Expense Split Tests
 * 
 * Tests the participant-based split algorithm:
 * - Participants = people who consumed/benefited from the expense
 * - Payer may or may not be a participant
 * - amountOwed = amount the participant owes the payer
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let flatId: string;
let chaitanyaId: string;
let rahulId: string;
let amanId: string;
let riyaId: string;

beforeAll(async () => {
  // Create test users
  const chaitanya = await prisma.user.create({
    data: { name: "Chaitanya", email: "chaitanya.test@example.com", passwordHash: "test" },
  });
  const rahul = await prisma.user.create({
    data: { name: "Rahul", email: "rahul.test@example.com", passwordHash: "test" },
  });
  const aman = await prisma.user.create({
    data: { name: "Aman", email: "aman.test@example.com", passwordHash: "test" },
  });
  const riya = await prisma.user.create({
    data: { name: "Riya", email: "riya.test@example.com", passwordHash: "test" },
  });

  chaitanyaId = chaitanya.id;
  rahulId = rahul.id;
  amanId = aman.id;
  riyaId = riya.id;

  // Create flat
  const flat = await prisma.flat.create({
    data: { name: "Test Flat", inviteCode: "TSTSPL", createdBy: chaitanyaId },
  });
  flatId = flat.id;

  // Add memberships
  for (const userId of [chaitanyaId, rahulId, amanId, riyaId]) {
    await prisma.membership.create({
      data: { flatId, userId, role: userId === chaitanyaId ? "ADMIN" : "MEMBER" },
    });
  }
});

afterAll(async () => {
  // Clean up test data
  await prisma.split.deleteMany({ where: { expense: { flatId } } });
  await prisma.expense.deleteMany({ where: { flatId } });
  await prisma.membership.deleteMany({ where: { flatId } });
  await prisma.flat.delete({ where: { id: flatId } });
  await prisma.user.deleteMany({
    where: { email: { in: ["chaitanya.test@example.com", "rahul.test@example.com", "aman.test@example.com", "riya.test@example.com"] } },
  });
  await prisma.$disconnect();
});

// Import the service function
const { addExpense } = await import("../src/services/expense.service.js");

describe("Expense Split Algorithm", () => {
  it("Case 1: Single participant, payer NOT included → full amount owed", async () => {
    // Rahul asks Chaitanya to buy milk. Only Rahul consumed it.
    const expense = await addExpense(
      flatId,
      chaitanyaId,      // paidBy
      "Milk for Rahul",
      20,               // amount
      "FOOD",
      "EQUAL",
      [rahulId]          // participants = [Rahul only]
    );

    expect(expense!.splits).toHaveLength(1);

    const rahulSplit = expense!.splits!.find((s: any) => s.userId === rahulId);
    expect(rahulSplit).toBeDefined();
    expect(Number(rahulSplit!.amountOwed)).toBe(20);

    // Chaitanya has no split row because he is not a participant
    const chaitanyaSplit = expense!.splits!.find((s: any) => s.userId === chaitanyaId);
    expect(chaitanyaSplit).toBeUndefined();
  });

  it("Case 2: Two participants including payer → each share = amount/2", async () => {
    // Both Chaitanya and Rahul drank the milk
    const expense = await addExpense(
      flatId,
      chaitanyaId,
      "Shared Milk",
      20,
      "FOOD",
      "EQUAL",
      [chaitanyaId, rahulId]  // participants = [Chaitanya, Rahul]
    );

    expect(expense!.splits).toHaveLength(2);

    const chaitanyaSplit = expense!.splits!.find((s: any) => s.userId === chaitanyaId);
    expect(chaitanyaSplit).toBeDefined();
    expect(Number(chaitanyaSplit!.amountOwed)).toBe(0); // Payer owes 0

    const rahulSplit = expense!.splits!.find((s: any) => s.userId === rahulId);
    expect(rahulSplit).toBeDefined();
    expect(Number(rahulSplit!.amountOwed)).toBe(10); // ₹20 / 2 = ₹10
  });

  it("Case 3: Four participants including payer → pizza split", async () => {
    const expense = await addExpense(
      flatId,
      chaitanyaId,
      "Pizza Night",
      400,
      "FOOD",
      "EQUAL",
      [chaitanyaId, rahulId, amanId, riyaId]  // All 4
    );

    expect(expense!.splits).toHaveLength(4);

    const chaitanyaSplit = expense!.splits!.find((s: any) => s.userId === chaitanyaId);
    expect(Number(chaitanyaSplit!.amountOwed)).toBe(0);

    const rahulSplit = expense!.splits!.find((s: any) => s.userId === rahulId);
    expect(Number(rahulSplit!.amountOwed)).toBe(100);

    const amanSplit = expense!.splits!.find((s: any) => s.userId === amanId);
    expect(Number(amanSplit!.amountOwed)).toBe(100);

    const riyaSplit = expense!.splits!.find((s: any) => s.userId === riyaId);
    expect(Number(riyaSplit!.amountOwed)).toBe(100);
  });

  it("Case 4: Empty participants → validation error", async () => {
    try {
      await addExpense(
        flatId,
        chaitanyaId,
        "Invalid Expense",
        100,
        "FOOD",
        "EQUAL",
        []  // Empty participants
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.message).toContain("participant");
    }
  });
});
