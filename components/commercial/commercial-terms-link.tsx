import Link from "next/link";
import { COMMERCIAL_TERMS_PATH } from "@/lib/commercial/public-terms";

export function CommercialTermsLink({
  className = "text-gold hover:underline",
}: {
  className?: string;
}) {
  return (
    <Link href={COMMERCIAL_TERMS_PATH} className={className} target="_blank" rel="noopener noreferrer">
      Termos de Uso Comercial/Beta
    </Link>
  );
}
