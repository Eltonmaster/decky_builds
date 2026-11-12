#!/usr/bin/env bash
# Packages the built plugin into a ZIP that Decky Loader can install
# (Settings → Developer → Install Plugin from ZIP File).
#
# Run after `pnpm build`. Writes out/<slug>-<version>.zip containing one
# top-level folder named after plugin.json's "name", like the Decky CLI does.
set -euo pipefail
cd "$(dirname "$0")/.."

name=$(python3 -c 'import json; print(json.load(open("plugin.json"))["name"])')
version=$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')
slug=$(python3 -c 'import json; print(json.load(open("package.json"))["name"])')

if [[ ! -f dist/index.js ]]; then
  echo "dist/index.js is missing; run 'pnpm build' first" >&2
  exit 1
fi

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
dest="$stage/$name"
mkdir -p "$dest"

cp -r dist main.py plugin.json package.json py_modules LICENSE README.md "$dest/"
# Like the Decky CLI, defaults/* goes into the plugin root (main.py looks there first).
cp -r defaults/. "$dest/"
find "$dest" -name '__pycache__' -type d -prune -exec rm -rf {} +

mkdir -p out
zip_path="$PWD/out/$slug-$version.zip"
rm -f "$zip_path"
(cd "$stage" && zip -qr "$zip_path" "$name")

echo "$zip_path"
