import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { signUp } from "@/services/auth.service";
import { signUpSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — TEAmo" },
      { name: "description", content: "Crie sua conta no TEAmo em poucos segundos." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/onboarding" });
  }, [loading, user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof f;
        if (k && !f[k]) f[k] = i.message;
      }
      setErrors(f);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await signUp(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível criar a conta.");
      return;
    }
    toast.success("Conta criada! Vamos cadastrar sua criança.");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <BrandLogo className="mb-8 text-4xl" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-xl font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comece a organizar o cuidado da sua criança em poucos minutos.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
            <PasswordRequirements password={password} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar conta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
