import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-10">
        <BrandLogo className="justify-center" />
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Carregando…</div>}>
        <LoginForm />
      </Suspense>
      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Operações em bolsa envolvem risco de perda parcial ou total do capital.
        Rentabilidade passada não garante resultados futuros.
      </p>
    </div>
  );
}
