#!/usr/bin/env bash
#
# Regenerates every mechanically derivable figure that the frontend structure documents quote.
#
# It prints Markdown fragments to stdout and writes nothing.
# Paste a section into `.claude/rules/struct.md` (and its `.agents/rules/struct.md` mirror) and
# into the root aggregator's `.claude/rules/STRUCT.md` when a figure has moved.
#
# It reads `git ls-files`, so an untracked or generated file is never counted as source.
# It does not update any document by itself, and it cannot check a prose claim - only a count,
# a list, a path, or a declared route.
#
# Usage:
#   ./scripts/regenerate_struct_figures.sh           # every section
#   ./scripts/regenerate_struct_figures.sh routes    # one section
#
# Sections: slices, tree, routes, deps, scripts, env

set -euo pipefail

cd "$(dirname "$0")/.."

section_slices() {
    echo "## Feature slices"
    echo

    local count
    count=$(git ls-files 'src/features/*' | sed 's#src/features/##; s#/.*##' | sort -u | wc -l | tr -d ' ')
    echo "Slices under \`src/features/\`: ${count}"
    echo

    echo "| Slice | Files | Lines |"
    echo "|-------|-------|-------|"
    local slice files lines
    for slice in $(git ls-files 'src/features/*' | sed 's#src/features/##; s#/.*##' | sort -u); do
        files=$(git ls-files "src/features/${slice}" | wc -l | tr -d ' ')
        lines=$(git ls-files "src/features/${slice}" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
        printf "| \`%s\` | %s | %s |\n" "${slice}" "${files}" "${lines}"
    done
    echo
    echo "Total tracked lines under \`src/\`: $(git ls-files src | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
    echo

    echo "### Sub-directories per slice"
    echo
    echo "| Slice | Sub-directories |"
    echo "|-------|-----------------|"
    local subdirs
    for slice in $(git ls-files 'src/features/*' | sed 's#src/features/##; s#/.*##' | sort -u); do
        subdirs=$(git ls-files "src/features/${slice}/*" |
            sed "s#src/features/${slice}/##" |
            grep '/' | sed 's#/.*##' | sort -u | tr '\n' ', ' | sed 's/,$//; s/,/, /g')
        printf "| \`%s\` | %s |\n" "${slice}" "${subdirs:-(none - flat)}"
    done
    echo
}

section_tree() {
    echo "## Top-level \`src/\` layout"
    echo
    echo "| Path | Entries |"
    echo "|------|---------|"
    local dir entries
    for dir in $(git ls-files 'src/*' | sed 's#src/##' | grep '/' | sed 's#/.*##' | sort -u); do
        entries=$(git ls-files "src/${dir}" | wc -l | tr -d ' ')
        printf "| \`src/%s/\` | %s |\n" "${dir}" "${entries}"
    done
    echo
    echo "Files directly in \`src/\`:"
    git ls-files 'src/*' | sed 's#src/##' | grep -v '/' | sed 's#^#- `#; s#$#`#'
    echo

    echo "### \`src/components/ui/\`"
    echo
    git ls-files 'src/components/ui/*' | sed 's#.*/##' | sed 's#^#- `#; s#$#`#'
    echo

    echo "### \`src/components/common/\`"
    echo
    git ls-files 'src/components/common/*' | sed 's#.*/##' | sed 's#^#- `#; s#$#`#'
    echo

    echo "### \`src/services/\`"
    echo
    git ls-files 'src/services/*' | sed 's#src/services/##' | sed 's#^#- `#; s#$#`#'
    echo

    echo "### \`src/api/\`, \`src/config/\`, \`src/store/\`, \`src/routes/\`, \`src/hooks/\`, \`src/utils/\`"
    echo
    local d
    for d in api config store routes hooks utils; do
        printf -- "- \`src/%s/\`: " "${d}"
        git ls-files "src/${d}/*" | sed "s#src/${d}/##" | tr '\n' ' '
        echo
    done
    echo
}

section_routes() {
    local constants='src/config/constants.js'

    echo "## Routes"
    echo
    echo "\`ROUTES\` in \`${constants}\` is the single declaration of every path; the router and"
    echo "every \`navigate()\` call read it back. The table is that object, in declaration order."
    echo

    echo "| Constant | Path |"
    echo "|----------|------|"
    sed -n '/^export const ROUTES = {/,/^};/p' "${constants}" |
        grep -oE "^  [A-Z_]+: '[^']*'" |
        sed "s/^  //; s/: '/|/; s/'$//" |
        awk -F'|' '{ printf "| `%s` | `%s` |\n", $1, $2 }'
    echo

    echo "### Files that declare route objects"
    echo
    git grep -l "path: ROUTES\.\|path: '" -- src | sed 's#^#- `#; s#$#`#'
    echo

    echo "### Screens registered in \`src/routes/appScreens.jsx\`"
    echo
    echo "Screen identifiers, deduplicated; a screen may be registered at more than one path."
    echo
    grep -oE "screen: '[^']+'" src/routes/appScreens.jsx |
        sed "s/screen: '//; s/'$//" | sort -u | sed 's#^#- `#; s#$#`#'
    echo

    echo "### Route constants used by \`src/features/admin/adminRoutes.jsx\`"
    echo
    grep -oE 'ROUTES\.[A-Z_]+' src/features/admin/adminRoutes.jsx |
        sort -u | sed 's#^#- `#; s#$#`#'
    echo
}

section_deps() {
    echo "## Dependencies"
    echo
    node -e '
        const p = require("./package.json");
        const rows = (obj, kind) =>
            Object.entries(obj || {}).map(([n, v]) => `| \`${n}\` | ${v} | ${kind} |`);
        const deps = Object.keys(p.dependencies || {}).length;
        const dev = Object.keys(p.devDependencies || {}).length;
        console.log(`Declared packages: ${deps + dev} (${deps} runtime, ${dev} dev).`);
        console.log("");
        console.log("| Package | Version | Kind |");
        console.log("|---------|---------|------|");
        console.log([
            ...rows(p.dependencies, "runtime"),
            ...rows(p.devDependencies, "dev"),
        ].join("\n"));
    '
    echo
    echo "Icon-set packages declared: $(node -e '
        const p = require("./package.json");
        const all = Object.keys({ ...p.dependencies, ...p.devDependencies });
        const icons = all.filter((n) => /lucide|heroicons|react-icons|feather|phosphor/.test(n));
        console.log(icons.length ? icons.join(", ") : "none");
    ')"
    echo
}

section_scripts() {
    echo "## npm scripts"
    echo
    echo "| Script | Command |"
    echo "|--------|---------|"
    node -e '
        const p = require("./package.json");
        console.log(Object.entries(p.scripts || {})
            .map(([n, c]) => `| \`npm run ${n}\` | \`${c}\` |`).join("\n"));
    '
    echo
}

section_env() {
    echo "## Environment variables"
    echo
    echo "Declared in \`.env.example\`. Every one carries the \`VITE_\` prefix Vite requires to"
    echo "expose a variable to browser code."
    echo
    grep -oE '^VITE_[A-Z_0-9]+' .env.example | sed 's#^#- `#; s#$#`#'
    echo
    echo -n "Variables referenced in \`src/\` but absent from \`.env.example\`: "
    comm -13 \
        <(grep -oE '^VITE_[A-Z_0-9]+' .env.example | sort -u) \
        <(git grep -hoE 'import\.meta\.env\.VITE_[A-Z_0-9]+' -- src |
            sed 's/import\.meta\.env\.//' | sort -u) |
        tr '\n' ' '
    echo
    echo
}

main() {
    local sections=("$@")
    if [ ${#sections[@]} -eq 0 ]; then
        sections=(slices tree routes deps scripts env)
    fi

    echo "# Frontend structure figures"
    echo
    echo "Generated by \`scripts/regenerate_struct_figures.sh\` from \`git ls-files\` at"
    echo "\`$(git rev-parse --short HEAD)\` on $(date -u '+%Y-%m-%d')."
    echo

    local section
    for section in "${sections[@]}"; do
        "section_${section}"
    done
}

main "$@"
