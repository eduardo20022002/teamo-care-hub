#!/usr/bin/env bash
# ============================================================================
# TEAmo · setup-env.sh
# ----------------------------------------------------------------------------
# Script interativo para criar/atualizar o .env local.
# - Lê chaves existentes e mostra um preview mascarado (•••XXX).
# - Pergunta cada valor; ENTER em branco preserva o que já existe.
# - Nunca imprime o valor digitado (digitação oculta para secrets).
# - Gera SHARE_JWT_SECRET / OTP_HMAC_SECRET automaticamente se faltarem.
# - Faz backup do .env anterior em .env.bak antes de sobrescrever.
# ============================================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
EXAMPLE_FILE="$PROJECT_DIR/.env.example"

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "✗ Não encontrei .env.example em $PROJECT_DIR" >&2
  exit 1
fi

# Cores (só pra leitura no terminal — sem impacto funcional)
BOLD=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[36m'; GREEN=$'\033[32m'
YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'

echo ""
echo "${BOLD}TEAmo · setup-env${RESET}"
echo "${DIM}Caminho: $ENV_FILE${RESET}"
echo ""

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

# Lê valor atual de uma chave do .env (se existir).
read_current() {
  local key="$1"
  if [[ -f "$ENV_FILE" ]]; then
    # Pega a última ocorrência da chave; tira o "KEY="
    grep -E "^${key}=" "$ENV_FILE" | tail -n1 | sed "s/^${key}=//"
  fi
}

# Mostra preview mascarado de um valor.
mask() {
  local v="$1"
  local len=${#v}
  if (( len == 0 )); then
    echo "${DIM}(vazio)${RESET}"
  elif (( len <= 8 )); then
    echo "${DIM}•••${RESET}"
  else
    local tail="${v: -4}"
    echo "${DIM}•••${tail}${RESET} ${DIM}(${len} chars)${RESET}"
  fi
}

# Pergunta por uma chave. Modo "secret" oculta o eco.
# Args: KEY  PROMPT  [secret]
ask() {
  local key="$1"
  local prompt="$2"
  local secret="${3:-}"
  local current
  current="$(read_current "$key" || true)"

  echo ""
  echo "${CYAN}${key}${RESET} — ${prompt}"
  if [[ -n "$current" ]]; then
    echo "  ${DIM}atual:${RESET} $(mask "$current")"
    echo "  ${DIM}ENTER para manter, ou digite o novo valor:${RESET}"
  else
    echo "  ${DIM}(ainda não definido)${RESET}"
  fi

  local input=""
  if [[ -n "$secret" ]]; then
    # Eco oculto — usado para chaves sensíveis (service_role, secrets)
    read -r -s input
    echo ""
  else
    read -r input
  fi

  if [[ -z "$input" ]]; then
    echo "$current"
  else
    echo "$input"
  fi
}

# Gera 64 hex chars usando node (já dependência do projeto)
gen_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# Escreve / atualiza KEY=VALUE no arquivo destino, preservando comentários do exemplo.
declare -A NEW_VALUES

set_value() {
  local key="$1"; local value="$2"
  NEW_VALUES["$key"]="$value"
}

# ----------------------------------------------------------------------------
# Coleta de valores
# ----------------------------------------------------------------------------

echo "${BOLD}1. Supabase — Project Settings → API${RESET}"
echo "${DIM}https://app.supabase.com/project/_/settings/api${RESET}"

SUPABASE_URL_VAL="$(ask SUPABASE_URL "URL do projeto (https://xxxx.supabase.co)")"
PROJECT_ID_VAL="$(ask VITE_SUPABASE_PROJECT_ID "Project ID (subdomínio antes de .supabase.co)")"
ANON_KEY_VAL="$(ask SUPABASE_PUBLISHABLE_KEY "anon public key (JWT)" secret)"
SERVICE_KEY_VAL="$(ask SUPABASE_SERVICE_ROLE_KEY "service_role key (SENSÍVEL — bypassa RLS)" secret)"

set_value VITE_SUPABASE_URL              "$SUPABASE_URL_VAL"
set_value SUPABASE_URL                   "$SUPABASE_URL_VAL"
set_value VITE_SUPABASE_PROJECT_ID       "$PROJECT_ID_VAL"
set_value VITE_SUPABASE_PUBLISHABLE_KEY  "$ANON_KEY_VAL"
set_value SUPABASE_PUBLISHABLE_KEY       "$ANON_KEY_VAL"
set_value SUPABASE_SERVICE_ROLE_KEY      "$SERVICE_KEY_VAL"

echo ""
echo "${BOLD}2. Secrets internos (compartilhamento + OTP)${RESET}"

SHARE_JWT_SECRET_VAL="$(ask SHARE_JWT_SECRET "JWT secret (64 hex). ENTER + 'g' gera automático" secret)"
if [[ "$SHARE_JWT_SECRET_VAL" == "g" || -z "$SHARE_JWT_SECRET_VAL" ]] && [[ -z "$(read_current SHARE_JWT_SECRET)" ]]; then
  SHARE_JWT_SECRET_VAL="$(gen_secret)"
  echo "  ${GREEN}✓ gerado automaticamente${RESET}"
fi
set_value SHARE_JWT_SECRET "$SHARE_JWT_SECRET_VAL"

OTP_HMAC_SECRET_VAL="$(ask OTP_HMAC_SECRET "OTP HMAC secret (64 hex). ENTER + 'g' gera automático" secret)"
if [[ "$OTP_HMAC_SECRET_VAL" == "g" || -z "$OTP_HMAC_SECRET_VAL" ]] && [[ -z "$(read_current OTP_HMAC_SECRET)" ]]; then
  OTP_HMAC_SECRET_VAL="$(gen_secret)"
  echo "  ${GREEN}✓ gerado automaticamente${RESET}"
fi
set_value OTP_HMAC_SECRET "$OTP_HMAC_SECRET_VAL"

echo ""
echo "${BOLD}3. Email — Resend (opcional para dev local)${RESET}"
echo "${DIM}https://resend.com/api-keys${RESET}"
RESEND_VAL="$(ask RESEND_API_KEY "Resend API key (re_...) — ENTER pula" secret)"
set_value RESEND_API_KEY "$RESEND_VAL"

LOVABLE_VAL="$(ask LOVABLE_API_KEY "Lovable API key — ENTER pula" secret)"
set_value LOVABLE_API_KEY "$LOVABLE_VAL"

echo ""
echo "${BOLD}4. Upstash Redis (opcional — só pra rate limit em produção)${RESET}"
echo "${DIM}https://console.upstash.com${RESET}"
UPSTASH_URL_VAL="$(ask UPSTASH_REDIS_REST_URL "Upstash REST URL — ENTER pula")"
UPSTASH_TOKEN_VAL="$(ask UPSTASH_REDIS_REST_TOKEN "Upstash REST token — ENTER pula" secret)"
set_value UPSTASH_REDIS_REST_URL "$UPSTASH_URL_VAL"
set_value UPSTASH_REDIS_REST_TOKEN "$UPSTASH_TOKEN_VAL"

# ----------------------------------------------------------------------------
# Grava o arquivo
# ----------------------------------------------------------------------------

if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$ENV_FILE.bak"
  echo ""
  echo "${DIM}backup salvo em .env.bak${RESET}"
fi

# Usa o .env.example como template; substitui linhas KEY=...
{
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^([A-Z_]+)= ]]; then
      key="${BASH_REMATCH[1]}"
      if [[ -n "${NEW_VALUES[$key]+set}" ]]; then
        printf '%s=%s\n' "$key" "${NEW_VALUES[$key]}"
        continue
      fi
    fi
    printf '%s\n' "$line"
  done < "$EXAMPLE_FILE"
} > "$ENV_FILE"

chmod 600 "$ENV_FILE"

echo ""
echo "${GREEN}✓ $ENV_FILE escrito (permissão 600 — só seu usuário lê).${RESET}"

# ----------------------------------------------------------------------------
# Sanity check: garantir que .env continua ignorado
# ----------------------------------------------------------------------------
if git -C "$PROJECT_DIR" check-ignore -q .env 2>/dev/null; then
  echo "${GREEN}✓ .env confirmado no .gitignore (não vai pro repo).${RESET}"
else
  echo "${RED}⚠ ATENÇÃO: .env não está sendo ignorado pelo git! Verifique o .gitignore.${RESET}"
fi

if git -C "$PROJECT_DIR" ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "${RED}⚠ ATENÇÃO: .env está rastreado pelo git. Rode 'git rm --cached .env' agora.${RESET}"
fi

echo ""
echo "${BOLD}Próximo passo:${RESET}"
echo "  supabase login && supabase link --project-ref ${PROJECT_ID_VAL:-SEU_PROJECT_ID}"
echo "  supabase db push        ${DIM}# roda as migrations${RESET}"
echo "  bun install && bun dev  ${DIM}# sobe o app${RESET}"
echo ""
