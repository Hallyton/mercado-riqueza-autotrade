import { redirect } from "next/navigation";
import { AUTOTRADE_LANDING_PATH } from "@/lib/commercial/autotrade-landing";

/** Alias público da landing comercial MR Fibo D1 Guard. */
export default function MrFiboD1GuardLandingAliasPage() {
  redirect(AUTOTRADE_LANDING_PATH);
}
