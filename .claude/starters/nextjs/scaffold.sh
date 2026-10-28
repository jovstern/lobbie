#!/usr/bin/env bash
# Creates the app with the latest create-next-app, lays the house stack on top (overlay/),
# and proves every gate passes. Run once, from the root of a fresh git repo.
# Usage: scaffold.sh <project-name> [tailwind|css-modules]   (default: tailwind)
set -euo pipefail

NAME="${1:?Usage: scaffold.sh <project-name> [tailwind|css-modules]}"
STYLING="${2:-tailwind}"
case "$STYLING" in tailwind) TW_FLAG=--tailwind ;; css-modules) TW_FLAG=--no-tailwind ;; *) echo "Styling must be tailwind or css-modules" >&2; exit 1 ;; esac
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Project name must be lowercase letters, digits, dots, dashes or underscores." >&2
  exit 1
fi
[ -d .git ] || { echo "Run this from the root of a git repository." >&2; exit 1; }
[ -e package.json ] && { echo "package.json already exists; the app is already scaffolded." >&2; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY="$HERE/overlay"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1. The framework's own starter, so config always matches the current Next.js release.
npx -y create-next-app@latest "$WORK/$NAME" --ts "$TW_FLAG" --eslint --app --no-src-dir \
  --react-compiler --import-alias '@/*' --use-npm --agents-md --no-agent-feedback \
  --disable-git --skip-install --yes

# Copy it in without touching anything already here (.claude/, docs/, README.md ...).
(cd "$WORK/$NAME" && find . -type f ! -path './node_modules/*' ! -path './.next/*') |
  while read -r file; do
    target="${file#./}"
    [ -e "$target" ] && { echo "skip   $target (already exists)"; continue; }
    mkdir -p "$(dirname "$target")"
    cp "$WORK/$NAME/$file" "$target"
  done

# 2. The house stack. Overlay files replace the starter's versions on purpose.
(cd "$OVERLAY" && find . -type f) | while read -r file; do
  target="${file#./}"
  if [ "$target" = "gitignore" ]; then
    touch .gitignore
    while read -r line; do grep -qxF "$line" .gitignore || echo "$line" >> .gitignore; done \
      < "$OVERLAY/gitignore"
    continue
  fi
  mkdir -p "$(dirname "$target")"
  sed "s/__PROJECT_NAME__/$NAME/g" "$OVERLAY/$file" > "$target"
done
# CSS Modules variant: its files replace the Tailwind ones from the overlay.
if [ "$STYLING" = css-modules ]; then
  (cd "$HERE/css-modules" && find . -type f) | while read -r file; do
    target="${file#./}"; mkdir -p "$(dirname "$target")"
    sed "s/__PROJECT_NAME__/$NAME/g" "$HERE/css-modules/$file" > "$target"
  done
fi
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg

npm pkg set name="$NAME" \
  scripts.typecheck="next typegen && tsc --noEmit" \
  scripts.lint="eslint . --max-warnings 0" \
  scripts.format="prettier --write ." \
  scripts.format:check="prettier --check ." \
  scripts.test="vitest run" \
  scripts.e2e="playwright test" \
  scripts.check="npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build" \
  engines.node=">=24"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
npm install
# The Next.js Learn course's own libraries. TanStack Query, TanStack Form and Zustand are not
# installed: a plan adds them only when it justifies it (see stack-conventions).
npm install zod clsx use-debounce radix-ui @heroicons/react
if [ "$STYLING" = tailwind ]; then PRETTIER_PLUGIN=prettier-plugin-tailwindcss; else PRETTIER_PLUGIN=prettier-plugin-css-order; fi
npm install -D "@types/node@$NODE_MAJOR" prettier "$PRETTIER_PLUGIN" vitest \
  @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom @playwright/test lefthook

npx prettier --write . > /dev/null
npx lefthook install
npx playwright install chromium
npm run check
npm run e2e
echo "Scaffold complete: all gates pass."
