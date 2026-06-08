import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a dummy user
  const email = "test@example.com";
  const password = "password123";
  const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 });

  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Dummy User",
        email,
        passwordHash,
      },
    });
    console.log("Created dummy user: dummy@example.com / password123");
  } else {
    // Ensure password is correct
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    console.log("Dummy user already exists, updated password: dummy@example.com / password123");
  }

  

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
