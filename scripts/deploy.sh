#!/usr/bin/env bash
# Build and deploy the Lambda code to an Alexa-hosted skill repository.
#
# Usage:
#   HOSTED_REPO_DIR=/path/to/alexa-hosted-clone npm run deploy
#   HOSTED_REPO_DIR=/path/to/alexa-hosted-clone npm run deploy -- --dry-run
#
# The Alexa-hosted clone is created once with:
#   ask init --hosted-skill-id <skill-id>
set -euo pipefail

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${HOSTED_REPO_DIR:-}" ]]; then
  cat >&2 <<'EOF'
HOSTED_REPO_DIR is not set.
Usage: HOSTED_REPO_DIR=/path/to/alexa-hosted-clone npm run deploy [-- --dry-run]
EOF
  exit 1
fi

HOSTED="$(cd "$HOSTED_REPO_DIR" 2>/dev/null && pwd)" || { echo "Not a directory: $HOSTED_REPO_DIR" >&2; exit 1; }

# Pre-flight checks
[[ -d "$HOSTED/.git" ]] || { echo "Not a git repository: $HOSTED" >&2; exit 1; }
[[ -d "$HOSTED/lambda" ]] || { echo "No lambda/ directory in $HOSTED (is this the Alexa-hosted clone?)" >&2; exit 1; }
[[ -f "$ROOT/lambda/stops.json" ]] || { echo "Missing lambda/stops.json (copy lambda/stops.example.json and edit it)" >&2; exit 1; }
# Only lambda/ is managed by this script; other files in the clone are left alone.
if [[ -n "$(git -C "$HOSTED" status --porcelain -- lambda)" ]]; then
  echo "Uncommitted changes in $HOSTED/lambda; commit or discard them first:" >&2
  git -C "$HOSTED" status --short -- lambda >&2
  exit 1
fi

echo "==> Test & build"
(cd "$ROOT" && npm test --silent && npm run build --silent)

echo "==> Copy to $HOSTED/lambda"
rm -rf "$HOSTED/lambda/dist"
cp -R "$ROOT/lambda/dist" "$HOSTED/lambda/dist"
cp "$ROOT/lambda/index.js" "$ROOT/lambda/package.json" "$ROOT/lambda/stops.json" "$HOSTED/lambda/"

# stops.json may be ignored by the hosted repo's .gitignore; force-add it.
git -C "$HOSTED" add -A lambda
git -C "$HOSTED" add -f lambda/stops.json

if git -C "$HOSTED" diff --cached --quiet -- lambda; then
  echo "No changes to deploy."
  exit 0
fi

if $DRY_RUN; then
  echo "==> Dry run: changes that would be deployed"
  git -C "$HOSTED" diff --cached --stat -- lambda
  git -C "$HOSTED" reset -q -- lambda
  git -C "$HOSTED" checkout -q -- lambda
  git -C "$HOSTED" clean -qfd lambda
  echo "Dry run complete; hosted repository restored."
  exit 0
fi

SRC_REV="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
[[ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]] && SRC_REV="$SRC_REV-dirty"

echo "==> Commit & push"
git -C "$HOSTED" commit -q -m "Deploy $SRC_REV" -- lambda
git -C "$HOSTED" push
echo "Pushed. Alexa-hosted will deploy it in about a minute."
