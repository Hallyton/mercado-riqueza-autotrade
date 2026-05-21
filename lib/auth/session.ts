import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { AppRole } from "./roles";

export async function getSession() {
  return auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireAppRole(role: AppRole) {
  const session = await requireAuth();
  if (session.user.appRole !== role) {
    redirect(role === "ADMIN" ? "/admin" : "/dashboard");
  }
  return session;
}
