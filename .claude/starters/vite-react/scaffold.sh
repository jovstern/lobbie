#!/usr/bin/env bash
# Copies the starter template into the current directory and proves the gates pass.
# Existing files are never overwritten. Usage: scaffold.sh <project-name> [tailwind|css-modules]
set -euo pipefail

NAME="${1:?Usage: scaffold.sh <project-name>}"
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Project name must be lowercase letters, digits, dots, dashes or underscores." >&2
  exit 1
fi

TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/template"
[ -d .git ] || { echo "Run this from the root of a git repository." >&2; exit 1; }

(cd "$TEMPLATE" && find . -type f) | while read -r file; do
  target="${file#./}"
  if [ "$target" = "gitignore" ]; then
    # Merge rather than skip: an existing .gitignore must still ignore build output.
    touch .gitignore
    while read -r line; do
      grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
    done < "$TEMPLATE/gitignore"
    echo "merge  .gitignore"
    continue
  fi
  if [ -e "$target" ]; then
    echo "skip   $target (already exists)"
    continue
  fi
  mkdir -p "$(dirname "$target")"
  sed "s/__PROJECT_NAME__/$NAME/g" "$TEMPLATE/$file" > "$target"
  echo "create $target"
done

# CSS Modules variant: drop Tailwind (Vite supports *.module.css out of the box).
if [ "${2:-tailwind}" = css-modules ]; then
  npm pkg delete devDependencies.tailwindcss devDependencies.@tailwindcss/vite devDependencies.prettier-plugin-tailwindcss
  npm pkg set devDependencies.prettier-plugin-css-order="^2.2.0"
  sed -i '' -e "/@tailwindcss\/vite/d" -e "s/, tailwindcss()//" vite.config.ts
  sed -i '' "s/prettier-plugin-tailwindcss/prettier-plugin-css-order/" .prettierrc.json
  printf ':root {\n  color-scheme: light;\n}\n' > src/index.css
  # The example feature keeps its markup; its Tailwind classes go (M1 replaces it anyway).
  sed -i '' -E 's/ className="[^"]*"//' src/App.tsx src/features/greeting/GreetingForm.tsx
fi

npm install
npx prettier --write . > /dev/null
npx lefthook install
npx playwright install chromium
npm run check
npm run e2e
echo "Scaffold complete: all gates pass."
