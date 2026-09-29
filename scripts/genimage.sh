#!/bin/sh
# Loads .env (if present) and runs the imagegen skill CLI over scripts/imagegen/prompts.jsonl.
# An OPENAI_API_KEY already in the environment wins unless .env sets it explicitly.
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
exec python3 .claude/skills/imagegen/scripts/image_gen.py generate-batch \
  --input scripts/imagegen/prompts.jsonl \
  --out-dir public/assets/gen \
  --model "${OPENAI_IMAGE_MODEL:-gpt-image-2.5-sunburst}" \
  --quality "${OPENAI_IMAGE_QUALITY:-high}" \
  --output-format webp \
  --concurrency 2 \
  "$@"
