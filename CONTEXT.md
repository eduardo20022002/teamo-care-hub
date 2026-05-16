# TEAmo — Contexto de Domínio

Usado pela skill `improve-codebase-architecture` para contextualizar refatorações e decisões arquiteturais.

---

## O que é o TEAmo

Plataforma de gestão do cuidado para famílias de pessoas com Transtorno do Espectro Autista (TEA). Centraliza histórico clínico, profissionais, documentos e compartilhamento seguro entre cuidadores.

---

## Usuários (roles)

| Role | Descrição |
|---|---|
| **Responsável / Cuidador** | Familiar que cadastra e gerencia o perfil do filho(a). Acesso total aos dados do seu dependente. |
| **Profissional** | Terapeuta, fonoaudiólogo, psicólogo, etc. Acesso apenas aos pacientes vinculados. |
| **Admin** | Equipe interna TEAmo. Acesso com audit log obrigatório. |

---

## Termos do domínio

| Termo | Significado técnico |
|---|---|
| **Dependente / Paciente** | Pessoa com TEA cujo cuidado está sendo gerenciado |
| **Cuidador** | Usuário responsável (pai, mãe, tutor) — dono dos dados |
| **Vínculo** | Relação entre profissional e paciente, com permissões e validade |
| **Sessão clínica** | Registro de atendimento (data, profissional, observações) |
| **Documento clínico** | Laudo, relatório ou exame armazenado no Supabase Storage |
| **Link de compartilhamento** | OTP com validade configurável para acesso externo controlado |
| **Onboarding** | Fluxo pós-cadastro: confirmação de email → dados do dependente → primeiro acesso |

---

## Dados sensíveis (LGPD art. 11)

Todos os dados abaixo são **dados sensíveis** e exigem RLS ativo, audit log e base legal explícita:

- Diagnóstico (CID, DSM)
- Histórico de sessões clínicas
- Documentos médicos e laudos
- Medicações em uso
- Dados do dependente (nome, data de nascimento)
- Dados de profissionais de saúde vinculados

---

## Fluxo principal do usuário

```
Cadastro → Verificação de email → Onboarding (dados do dependente)
→ Dashboard → [Sessões | Documentos | Profissionais | Compartilhamento]
```

---

## Invariantes de segurança

- Cuidador só acessa dados dos seus próprios dependentes
- Profissional só acessa dados de pacientes com vínculo ativo
- Nenhuma query retorna dados de outro tenant
- Todo acesso a dado sensível gera entrada em `audit_logs`
- Links de compartilhamento expiram — nunca são permanentes
