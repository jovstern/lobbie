#!/usr/bin/env bash
# Creates ~/Mnt/<name> with a copy of this kit, ready for /build.
# Usage: new-project.sh <name> [one-line description]
set -euo pipefail

NAME="${1:?Usage: new-project.sh <name> [description]}"
DESCRIPTION="${2:-}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "Name must be lowercase letters, digits and dashes." >&2; exit 1; }

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DEST="$HOME/Mnt/$NAME"
[ -e "$DEST" ] && { echo "$DEST already exists." >&2; exit 1; }

mkdir -p "$DEST/.claude"
for part in agents skills starters settings.json README.md CLAUDE.template.md; do
  cp -R "$KIT/.claude/$part" "$DEST/.claude/"
done

sed -e "s/__PROJECT_NAME__/$NAME/g" -e "s|__ONE_LINE__|${DESCRIPTION:-Described by /build.}|" \
  "$KIT/.claude/CLAUDE.template.md" > "$DEST/CLAUDE.md"
printf '.claude/settings.local.json\n.superpowers/\n.metrics/\n.DS_Store\n.idea/\n.env*\n!.env.example\nnode_modules/\n' \
  > "$DEST/.gitignore"

cd "$DEST"
git init -q -b master
git add -A
git commit -qm "chore: start $NAME from the kit"
# The Figma MCP for this folder only; it asks to log in the first time it is used.
claude mcp add --transport http --scope local figma https://mcp.figma.com/mcp >/dev/null 2>&1 \
  || echo "Note: could not add the Figma MCP; add it later with: claude mcp add --transport http --scope local figma https://mcp.figma.com/mcp"

echo "Created $DEST"
