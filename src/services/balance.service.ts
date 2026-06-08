import { prisma } from "../db/index.js";

interface BalanceEntry {
  from: { userId: string; name: string };
  to: { userId: string; name: string };
  amount: number;
}

interface MyBalances {
  youOwe: Array<{ userId: string; name: string; amount: number }>;
  owedToYou: Array<{ userId: string; name: string; amount: number }>;
  netTotal: number;
}

export async function getBalanceMatrix(flatId: string): Promise<BalanceEntry[]> {
  // 1. Get all unsettled splits with expense payer info
  const splits = await prisma.split.findMany({
    where: {
      expense: { flatId },
      isSettled: false,
      amountOwed: { gt: 0 },
    },
    include: {
      expense: { select: { paidBy: true } },
      user: { select: { id: true, name: true } },
    },
  });

  // 2. Build raw balance map: balances[debtor][creditor] = total owed
  const balances: Record<string, Record<string, number>> = {};

  for (const split of splits) {
    const debtor = split.userId;
    const creditor = split.expense.paidBy;

    if (debtor === creditor) continue; // Skip payer's own row

    if (!balances[debtor]) balances[debtor] = {};
    if (!balances[debtor]![creditor]) balances[debtor]![creditor] = 0;
    balances[debtor]![creditor]! += Number(split.amountOwed);
  }

  // 3. Factor in settlements
  const settlements = await prisma.settlement.findMany({
    where: { flatId },
  });

  for (const settlement of settlements) {
    const from = settlement.fromUser;
    const to = settlement.toUser;
    const amount = Number(settlement.amount);

    // Settlement reduces what 'from' owes 'to'
    if (balances[from]?.[to]) {
      balances[from]![to]! -= amount;
    } else {
      // If from doesn't owe to, then to now owes from
      if (!balances[to]) balances[to] = {};
      if (!balances[to]![from]) balances[to]![from] = 0;
      balances[to]![from]! += amount;
    }
  }

  // 4. Compute net balances for each pair
  const processed = new Set<string>();
  const result: BalanceEntry[] = [];

  // Get all user names for the flat
  const members = await prisma.membership.findMany({
    where: { flatId, isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });
  const nameMap: Record<string, string> = {};
  for (const m of members) {
    nameMap[m.userId] = m.user.name;
  }

  // Also include names from splits for inactive members
  for (const split of splits) {
    if (!nameMap[split.userId]) {
      nameMap[split.userId] = split.user.name;
    }
  }

  const allUsers = new Set([
    ...Object.keys(balances),
    ...Object.values(balances).flatMap((v) => Object.keys(v)),
  ]);

  for (const userA of allUsers) {
    for (const userB of allUsers) {
      if (userA === userB) continue;
      const pairKey = [userA, userB].sort().join("-");
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const aOwesB = balances[userA]?.[userB] ?? 0;
      const bOwesA = balances[userB]?.[userA] ?? 0;
      const net = Math.round((aOwesB - bOwesA) * 100) / 100;

      if (net > 0) {
        result.push({
          from: { userId: userA, name: nameMap[userA] ?? "Unknown" },
          to: { userId: userB, name: nameMap[userB] ?? "Unknown" },
          amount: net,
        });
      } else if (net < 0) {
        result.push({
          from: { userId: userB, name: nameMap[userB] ?? "Unknown" },
          to: { userId: userA, name: nameMap[userA] ?? "Unknown" },
          amount: Math.abs(net),
        });
      }
    }
  }

  return result;
}

export async function getMyBalances(flatId: string, userId: string): Promise<MyBalances> {
  const matrix = await getBalanceMatrix(flatId);

  const youOwe: Array<{ userId: string; name: string; amount: number }> = [];
  const owedToYou: Array<{ userId: string; name: string; amount: number }> = [];

  for (const entry of matrix) {
    if (entry.from.userId === userId) {
      youOwe.push({
        userId: entry.to.userId,
        name: entry.to.name,
        amount: entry.amount,
      });
    }
    if (entry.to.userId === userId) {
      owedToYou.push({
        userId: entry.from.userId,
        name: entry.from.name,
        amount: entry.amount,
      });
    }
  }

  const totalOwed = owedToYou.reduce((sum, e) => sum + e.amount, 0);
  const totalOwe = youOwe.reduce((sum, e) => sum + e.amount, 0);
  const netTotal = Math.round((totalOwed - totalOwe) * 100) / 100;

  return { youOwe, owedToYou, netTotal };
}
