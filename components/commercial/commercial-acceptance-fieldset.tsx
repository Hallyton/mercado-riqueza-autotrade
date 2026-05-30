import { CommercialTermsLink } from "./commercial-terms-link";
import { SIGNUP_ACCEPTANCE_LABELS } from "@/lib/commercial/public-terms";

export function CommercialAcceptanceFieldset() {
  return (
    <fieldset className="space-y-3 rounded-lg border border-white/10 p-4 text-sm">
      <legend className="px-1 text-xs font-medium text-muted-foreground">
        Aceites obrigatórios
      </legend>
      <label className="flex gap-2">
        <input type="checkbox" name="acceptTerms" required className="mt-1 shrink-0" />
        <span>
          Li e aceito os <CommercialTermsLink />.
        </span>
      </label>
      <label className="flex gap-2">
        <input type="checkbox" name="acceptRisk" required className="mt-1 shrink-0" />
        <span>{SIGNUP_ACCEPTANCE_LABELS.risk}</span>
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          name="acceptNoReturnGuarantee"
          required
          className="mt-1 shrink-0"
        />
        <span>{SIGNUP_ACCEPTANCE_LABELS.noReturn}</span>
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          name="acceptRealRequiresApproval"
          required
          className="mt-1 shrink-0"
        />
        <span>{SIGNUP_ACCEPTANCE_LABELS.realApproval}</span>
      </label>
      <label className="flex gap-2">
        <input type="checkbox" name="acceptBlackBox" required className="mt-1 shrink-0" />
        <span>{SIGNUP_ACCEPTANCE_LABELS.proprietary}</span>
      </label>
    </fieldset>
  );
}
