import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_auth/ajuda")({
  head: () => ({
    meta: [{ title: "Ajuda — TEAmo" }],
  }),
  component: AjudaPage,
});

const FAQS = [
  {
    q: "O que é o TEAmo?",
    a: "O TEAmo é um aplicativo de gestão de cuidados para famílias de crianças com TEA (Transtorno do Espectro Autista). Ele centraliza registros de atendimentos, documentos clínicos, profissionais da equipe e compromissos da agenda em um único lugar seguro.",
  },
  {
    q: "Como compartilhar registros com um profissional?",
    a: 'Acesse "Compartilhamentos" no menu principal. Selecione um profissional, escolha quais itens quer incluir e gere um link com validade configurável. O profissional receberá um código por e-mail para acessar o conteúdo de forma segura.',
  },
  {
    q: "Os dados do meu filho são protegidos?",
    a: "Sim. Todos os dados são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). O acesso é controlado por Row-Level Security — nenhum dado de uma família é visível para outra. O TEAmo segue as diretrizes da LGPD.",
  },
  {
    q: "Como funciona o link de compartilhamento?",
    a: "O link gera um código OTP (senha de uso único) enviado ao e-mail do profissional. Após a validação, ele tem acesso temporário aos itens selecionados. O link expira automaticamente na data configurada e não pode ser reutilizado após o consumo sem renovação.",
  },
  {
    q: "Posso adicionar mais de uma criança?",
    a: 'Sim. Acesse "Meu perfil" e toque em "+ Adicionar" na seção de crianças. Cada criança tem seu próprio histórico de registros, documentos e agenda.',
  },
  {
    q: "Como excluir minha conta?",
    a: "Acesse Meu perfil → Conta → Excluir minha conta. Por segurança, a exclusão requer confirmação e entra em contato com nossa equipe. Se preferir, envie um e-mail para suporte@teamotech.online.",
  },
];

function AjudaPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <div className="mb-5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar ao início
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <HelpCircle className="h-6 w-6 text-accent" strokeWidth={1.75} />
            Ajuda e dúvidas frequentes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Respostas rápidas para as perguntas mais comuns.
          </p>
        </header>

        <Accordion type="single" collapsible className="space-y-2">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <AccordionTrigger className="px-4 py-3.5 text-sm font-semibold text-foreground hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Não encontrou o que procurava?
          </p>
          <a
            href="mailto:suporte@teamotech.online"
            className="mt-1 block text-sm font-semibold text-primary hover:underline"
          >
            suporte@teamotech.online
          </a>
        </div>
      </div>
    </AppShell>
  );
}
