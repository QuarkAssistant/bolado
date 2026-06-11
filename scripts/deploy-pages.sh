#!/usr/bin/env bash
set -euo pipefail

# Build and deploy Bolado to Cloudflare Pages (bolado.pages.dev).
# The Pages project already exists; wrangler auth is ambient.

cd "$(dirname "$0")/.."

npm run build

# Bolado-specific headers: immutable hashed /assets chunks, never-cache the shell.
cat > dist/_headers <<'EOF'
/
  Cache-Control: max-age=0, must-revalidate

/index.html
  Cache-Control: max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
EOF

npx wrangler pages deploy dist --project-name=bolado --branch main
