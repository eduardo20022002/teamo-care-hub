import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { signIn } from "@/services/auth.service";
import { signInSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — TEAmo" },
      { name: "description", content: "Acesse sua conta TEAmo." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
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
    const res = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível entrar.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <BrandLogo className="mb-8 text-4xl" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-xl font-semibold text-foreground">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse sua conta para acompanhar o cuidado da sua família.
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
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
