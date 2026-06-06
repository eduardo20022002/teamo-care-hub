import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — TEAmo" },
      { name: "description", content: "Termos de Uso da plataforma TEAmo." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFC] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/cadastro"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>

        <h1 className="text-2xl font-bold text-foreground">Termos de Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: junho de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">1. Sobre o TEAmo</h2>
            <p>
              O TEAmo é uma plataforma de apoio à coordenação do cuidado de crianças com Transtorno
              do Espectro Autista (TEA), desenvolvida como projeto acadêmico (TCC) pela Universidade
              Federal de Pernambuco (UFPE). Tem caráter educacional e experimental — não substitui
              orientação médica ou terapêutica profissional.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">2. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta e utilizar o TEAmo, você confirma que leu, compreendeu e concorda
              com estes Termos de Uso. O uso da plataforma por menores de 18 anos deve ser
              supervisionado por um responsável legal.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">3. Uso permitido</h2>
            <p>A plataforma pode ser utilizada para:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Registrar e acompanhar o histórico de desenvolvimento da criança.</li>
              <li>Compartilhar informações com profissionais de saúde autorizados.</li>
              <li>Comunicar-se com terapeutas dentro do ambiente seguro da plataforma.</li>
            </ul>
            <p className="mt-2">É vedado:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Usar a plataforma para fins comerciais não autorizados.</li>
              <li>Compartilhar credenciais de acesso com terceiros.</li>
              <li>Inserir dados falsos ou usar a plataforma de forma prejudicial a terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">4. Dados e privacidade</h2>
            <p>
              Seus dados são tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD —
              Lei 13.709/2018). Consulte nossa{" "}
              <Link to="/privacidade" className="font-medium text-primary hover:underline">
                Política de Privacidade
              </Link>{" "}
              para entender quais dados coletamos, como os utilizamos e quais são seus direitos.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">5. Exclusão de conta</h2>
            <p>
              Você pode excluir sua conta a qualquer momento através das configurações de perfil.
              A exclusão é irreversível e remove permanentemente todos os dados associados à sua
              conta, em atendimento ao Art. 18 da LGPD (direito ao esquecimento).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">6. Disponibilidade</h2>
            <p>
              Por ser um projeto acadêmico em fase de desenvolvimento, o TEAmo pode apresentar
              instabilidades ou ser descontinuado sem aviso prévio. Recomendamos não utilizar a
              plataforma como único repositório de informações clínicas críticas.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">7. Contato</h2>
            <p>
              Dúvidas sobre estes termos podem ser enviadas para{" "}
              <a
                href="mailto:eduardo.meirelles@ufpe.br"
                className="font-medium text-primary hover:underline"
              >
                eduardo.meirelles@ufpe.br
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
