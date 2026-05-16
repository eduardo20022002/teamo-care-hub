# ADR-003 — Row-Level Security obrigatório em toda tabela com dado sensível

**Data:** 2026-05  
**Status:** Aceito

## Decisão

Toda tabela que armazena dado de paciente ou dado clínico deve ter RLS habilitado antes do primeiro INSERT. Sem exceção.

## Razões

- TEAmo lida com dados sensíveis de saúde (LGPD art. 11) — vazamento inter-tenant é uma violação crítica
- RLS no banco é a última linha de defesa: mesmo que a aplicação falhe, o banco não entrega dados de outro usuário
- Política: cuidador só lê/escreve seus próprios dependentes; profissional só lê pacientes com vínculo ativo

## Consequências

- Toda migration nova deve incluir `ALTER TABLE x ENABLE ROW LEVEL SECURITY` e as policies antes de qualquer dado de teste
- Nunca usar policy `USING (true)` em tabela com dado sensível
- Testes de RLS são obrigatórios para cada role antes do merge
