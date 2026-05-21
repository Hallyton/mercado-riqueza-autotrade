import type { AppRole } from "@/lib/auth/roles";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    appRole: AppRole;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      appRole: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    appRole: AppRole;
  }
}
