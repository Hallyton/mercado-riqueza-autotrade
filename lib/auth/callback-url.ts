export function resolvePostLoginDestination({
  callbackUrl,
  appRole,
}: {
  callbackUrl: string | null | undefined;
  appRole: "ADMIN" | "CLIENT" | undefined;
}): string {
  const defaultDest = appRole === "ADMIN" ? "/admin" : "/dashboard";
  const requested = callbackUrl ?? defaultDest;

  if (appRole === "ADMIN" && requested.startsWith("/dashboard")) {
    return "/admin";
  }

  if (appRole === "CLIENT" && requested.startsWith("/admin")) {
    return "/dashboard";
  }

  if (requested.startsWith("/") && !requested.startsWith("//")) {
    return requested;
  }

  return defaultDest;
}
