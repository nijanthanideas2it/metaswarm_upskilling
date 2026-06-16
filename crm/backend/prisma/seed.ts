import bcrypt from "bcryptjs";
import { Role, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("Admin123!", 12);

  await prisma.user.upsert({
    where: {
      email: "admin@co.com"
    },
    update: {},
    create: {
      email: "admin@co.com",
      passwordHash,
      role: Role.ADMIN
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
