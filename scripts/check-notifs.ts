import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.notification.count();
  const notifs = await prisma.notification.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log(`Total notifications: ${count}`);
  console.dir(notifs, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
