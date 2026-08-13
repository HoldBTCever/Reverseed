import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "corretor@reverseed.com.py";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "mudeesta123";
  const adminName = process.env.ADMIN_NAME ?? "Corretor";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      role: "ADMIN",
      name: adminName,
      email: adminEmail,
      passwordHash,
    },
  });

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, usdToPyg: 7300, usdToBrl: 5.4 },
  });

  console.log(`Usuário admin pronto: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Senha padrão (mude depois de logar): ${adminPassword}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
