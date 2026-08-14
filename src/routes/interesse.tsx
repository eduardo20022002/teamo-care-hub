// ─── Formulário público de interesse ─────────────────────────────────────────
// Página de captação: fica FORA do app (sem auth, sem layout interno). Quem
// preenche recebe o e-mail com o link de cadastro na hora e entra no motor de
// ciclo de vida — o follow-up passa a ser automático.

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { submitInterestServer } from "@/lib/interesse.functions";

export const Route = createFileRoute("/interesse")({
  head: () => ({
    meta: [
      { title: "Conheça o TEAmo" },
      {
        name: "description",
        content:
          "O TEAmo reúne num só lugar a evolução, as conquistas e o cuidado de crianças com TEA — para famílias e profissionais.",
      },
    ],
  }),
  component: InteressePage,
});

type Papel = "parent" | "therapist";

interface InterestPayload {
  nome: string;
  email: string;
  papel: Papel;
  mensagem?: string;
  consentimento: true;
  website?: string;
}

function InteressePage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel | "">("");
  const [mensagem, setMensagem] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [erro, setErro] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: (payload: InterestPayload) => submitInterestServer({ data: payload }),
  });

  const resultado = submit.data;
  const enviado = resultado?.ok === true;
  const jaTemConta = resultado?.ok === true && resultado.jaTemConta;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!papel) return setErro("Escolha como você vai usar o TEAmo.");
    if (!consentimento) return setErro("É preciso aceitar para continuar.");

    submit.mutate(
      { nome, email, papel, mensagem: mensagem || undefined, consentimento: true, website },
      {
        onSuccess: (res) => {
          if (!res.ok) setErro(res.error);
        },
        onError: () =>
          setErro("Não foi possível enviar agora. Verifique os dados e tente de novo."),
      },
    );
  }

  if (enviado) {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h2 className="mt-4 text-xl font-bold">Tudo certo!</h2>
          {jaTemConta ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Você já tem uma conta no TEAmo com esse e-mail. É só entrar — e se
              esqueceu a senha, dá para recuperar na tela de acesso.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enviamos para <strong>{email}</strong> o link para criar sua conta.
              Se não chegar em alguns minutos, vale olhar no spam.
            </p>
          )}
          <Link
            to="/cadastro"
            className="mt-6 inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground"
          >
            {jaTemConta ? "Ir para o TEAmo" : "Criar minha conta agora"}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-extrabold tracking-tight">
        Cuidar de quem você ama, sem perder nada pelo caminho
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        O TEAmo reúne num lugar só o que hoje fica espalhado entre cadernos, grupos
        de WhatsApp e a memória de cada um: a evolução, as conquistas e o combinado
        entre todos que cuidam.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Seu nome" htmlFor="nome">
          <input
            id="nome" required value={nome} onChange={(e) => setNome(e.target.value)}
            autoComplete="name" className={inputCls} placeholder="Como podemos te chamar?"
          />
        </Field>

        <Field label="Seu e-mail" htmlFor="email">
          <input
            id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email"
            className={inputCls} placeholder="voce@email.com"
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold">Como você vai usar o TEAmo?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <PapelOption
              value="parent" checked={papel === "parent"} onSelect={setPapel}
              titulo="Sou família" descricao="Pai, mãe ou responsável"
            />
            <PapelOption
              value="therapist" checked={papel === "therapist"} onSelect={setPapel}
              titulo="Sou profissional" descricao="Terapeuta ou clínica"
            />
          </div>
        </fieldset>

        <Field label="Quer contar algo? (opcional)" htmlFor="mensagem">
          <textarea
            id="mensagem" rows={3} value={mensagem} maxLength={1000}
            onChange={(e) => setMensagem(e.target.value)} className={inputCls}
            placeholder="O que você espera do TEAmo?"
          />
        </Field>

        {/* Honeypot: invisível para humanos, atrai bots. */}
        <div aria-hidden className="hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website" tabIndex={-1} autoComplete="off"
            value={website} onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox" checked={consentimento} required
            onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-input"
          />
          <span className="text-muted-foreground">
            Aceito receber e-mails do TEAmo sobre meu acesso e li a{" "}
            <Link to="/privacidade" className="font-medium text-primary underline">
              política de privacidade
            </Link>
            . Posso pedir para sair a qualquer momento.
          </span>
        </label>

        {erro && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {erro}
          </p>
        )}

        <button
          type="submit" disabled={submit.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {submit.isPending ? "Enviando..." : "Quero conhecer o TEAmo"}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary underline">Entrar</Link>
        </p>
      </form>
    </Shell>
  );
}

// ─── Peças de layout ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-2xl font-extrabold">
            <span className="text-primary">TEA</span>
            <span className="text-accent">mo</span>
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            Acompanhamento terapêutico para crianças com TEA
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}

function Field({
  label, htmlFor, children,
}: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function PapelOption({
  value, checked, onSelect, titulo, descricao,
}: {
  value: Papel; checked: boolean; onSelect: (p: Papel) => void;
  titulo: string; descricao: string;
}) {
  return (
    <label
      className={`cursor-pointer rounded-xl border p-3 transition ${
        checked ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted/60"
      }`}
    >
      <input
        type="radio" name="papel" value={value} checked={checked}
        onChange={() => onSelect(value)} className="sr-only"
      />
      <span className="block text-sm font-semibold">{titulo}</span>
      <span className="block text-xs text-muted-foreground">{descricao}</span>
    </label>
  );
}
