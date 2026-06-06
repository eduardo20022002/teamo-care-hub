import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — TEAmo" },
      { name: "description", content: "Política de Privacidade da plataforma TEAmo." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
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

        <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: junho de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">1. Controlador dos dados</h2>
            <p>
              Os dados pessoais coletados pelo TEAmo são de responsabilidade do projeto acadêmico
              TEAmo, vinculado à Universidade Federal de Pernambuco (UFPE). Contato:{" "}
              <a href="mailto:eduardo.meirelles@ufpe.br" className="font-medium text-primary hover:underline">
                eduardo.meirelles@ufpe.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">2. Dados coletados</h2>
            <p>Coletamos apenas os dados necessários para o funcionamento da plataforma:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, tipo de perfil (responsável ou terapeuta).</li>
              <li><strong>Dados da criança:</strong> nome, data de nascimento (informados pelo responsável).</li>
              <li><strong>Registros clínicos:</strong> observações de sessões, registros de comportamento, marcos de desenvolvimento — inseridos pelos usuários.</li>
              <li><strong>Dados de uso:</strong> logs de autenticação (login, logout, troca de senha) para fins de segurança e auditoria.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">3. Finalidade e base legal</h2>
            <p>Os dados são utilizados exclusivamente para:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Prestar os serviços de coordenação de cuidado oferecidos pela plataforma.</li>
              <li>Garantir a segurança das contas e detectar acessos não autorizados.</li>
            </ul>
            <p className="mt-2">
              A base legal é o <strong>consentimento</strong> (Art. 7°, I da LGPD), obtido no
              momento do cadastro, e a <strong>execução de contrato</strong> (Art. 7°, V), para a
              prestação dos serviços contratados.
            </p>
            <p className="mt-2">
              Dados de saúde de crianças são tratados como dados sensíveis (Art. 11 da LGPD) e
              sujeitos a proteção reforçada.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">4. Compartilhamento</h2>
            <p>
              Seus dados <strong>não são vendidos ou compartilhados com terceiros</strong> para fins
              comerciais. O compartilhamento ocorre apenas:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Com terapeutas e co-responsáveis que você mesmo autoriza dentro da plataforma.</li>
              <li>Com a Supabase (provedor de infraestrutura), que atua como operador de dados sob
              contrato com obrigações de proteção equivalentes.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">5. Retenção de dados</h2>
            <p>
              Os dados são mantidos enquanto sua conta estiver ativa. Logs de autenticação são
              retidos por no máximo 12 meses (365 dias), salvo obrigações legais. Ao excluir sua
              conta, todos os dados pessoais são removidos permanentemente (Art. 16 da LGPD —
              mínimo necessário).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">6. Seus direitos (Art. 18 da LGPD)</h2>
            <p>Você tem direito a:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Acesso:</strong> consultar quais dados armazenamos sobre você.</li>
              <li><strong>Correção:</strong> atualizar informações incorretas pelo próprio perfil.</li>
              <li><strong>Exclusão:</strong> apagar sua conta e todos os dados associados.</li>
              <li><strong>Portabilidade:</strong> solicitar uma cópia dos seus dados em formato estruturado.</li>
              <li><strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento, excluindo a conta.</li>
            </ul>
            <p className="mt-2">
              Para exercer esses direitos, entre em contato:{" "}
              <a href="mailto:eduardo.meirelles@ufpe.br" className="font-medium text-primary hover:underline">
                eduardo.meirelles@ufpe.br
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">7. Segurança</h2>
            <p>
              Adotamos medidas técnicas de segurança, incluindo: criptografia em trânsito (HTTPS),
              Row-Level Security no banco de dados, autenticação em dois fatores (2FA opcional),
              e timeout de sessão por inatividade. Nenhum sistema é 100% seguro — notifique-nos
              imediatamente se suspeitar de acesso indevido.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-foreground">8. Alterações nesta política</h2>
            <p>
              Esta política pode ser atualizada. Alterações relevantes serão comunicadas por e-mail
              ou notificação no app com antecedência mínima de 15 dias.
            </p>
          </section>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              Esta política está em conformidade com a Lei Geral de Proteção de Dados Pessoais
              (LGPD — Lei nº 13.709/2018). Dúvidas:{" "}
              <a href="mailto:eduardo.meirelles@ufpe.br" className="hover:underline">
                eduardo.meirelles@ufpe.br
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
