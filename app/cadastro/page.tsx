import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { SignupForm } from "@/components/commercial/signup-form";

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12">
      <div className="mb-8">
        <Link href="/planos">
          <BrandLogo className="justify-center" />
        </Link>
      </div>
      <SignupForm />
      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Rentabilidade passada não garante resultados futuros. Cadastro sujeito a revisão
        comercial. Nenhuma operação real é liberada automaticamente.
      </p>
    </div>
  );
}
