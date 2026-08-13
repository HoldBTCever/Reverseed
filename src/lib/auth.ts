import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { clientProfile: true },
  });
  return user;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/admin");
  if (session.role !== "ADMIN") redirect("/imoveis");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/entrar?next=/admin");
  return user;
}

export async function requireClient() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/imoveis");
  if (session.role !== "CLIENT") redirect("/admin");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { clientProfile: true },
  });
  if (!user) redirect("/entrar?next=/imoveis");
  return user;
}
