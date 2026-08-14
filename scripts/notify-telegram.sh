#!/usr/bin/env bash
# Notificação one-way para o Telegram (Fase 2 dos revisores em nuvem).
# Uso:   ./scripts/notify-telegram.sh "texto da mensagem"
#   ou:  echo "texto" | ./scripts/notify-telegram.sh
#
# Requer duas variáveis de ambiente (NUNCA hardcodar — ficam no .env local,
# fora do git, ou nos secrets do ambiente da routine):
#   TELEGRAM_BOT_TOKEN  — token do bot criado no @BotFather
#   TELEGRAM_CHAT_ID    — seu chat id (fale com o bot e pegue via getUpdates)
#
# Setup do bot (1x):
#   1. No Telegram, fale com @BotFather → /newbot → copie o token.
#   2. Mande qualquer mensagem para o seu bot novo.
#   3. Pegue seu chat_id:
#        curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -o '"id":[0-9]*'
#   4. Salve TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env (gitignored).

set -euo pipefail

# Carrega .env local se existir (não falha se não existir).
if [[ -f "$(dirname "$0")/../.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$(dirname "$0")/../.env"
  set +a
fi

: "${TELEGRAM_BOT_TOKEN:?defina TELEGRAM_BOT_TOKEN (não hardcode — use .env)}"
: "${TELEGRAM_CHAT_ID:?defina TELEGRAM_CHAT_ID (não hardcode — use .env)}"

# Texto vem do 1º argumento ou do stdin.
if [[ $# -ge 1 ]]; then
  MSG="$1"
else
  MSG="$(cat)"
fi

if [[ -z "${MSG// }" ]]; then
  echo "notify-telegram: mensagem vazia, nada a enviar." >&2
  exit 0
fi

curl -sS -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MSG}" \
  --data-urlencode "disable_web_page_preview=true" \
  > /dev/null

echo "notify-telegram: enviado (${#MSG} chars)."
