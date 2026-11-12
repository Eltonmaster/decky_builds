"""Installed Steam games, read from libraryfolders.vdf and appmanifest_*.acf."""

from __future__ import annotations

import glob
import os
import re

# Tools that show up as installed apps but are not games.
SKIP_APPIDS = {228980}  # Steamworks Common Redistributables
SKIP_NAME_PREFIXES = ("proton", "steam linux runtime", "steamvr")

_TOKEN = re.compile(r'"((?:[^"\\]|\\.)*)"|([{}])|//[^\n]*')


def parse_vdf(text: str) -> dict:
    """Parse Valve's text KeyValues format into nested dicts (keys lowercased)."""
    root: dict = {}
    stack = [root]
    key = None
    for m in _TOKEN.finditer(text):
        s, brace = m.group(1), m.group(2)
        if s is None and brace is None:
            continue  # comment
        if brace == "{":
            new: dict = {}
            if key is not None:
                stack[-1][key.lower()] = new
            stack.append(new)
            key = None
        elif brace == "}":
            if len(stack) > 1:
                stack.pop()
            key = None
        else:
            s = s.replace('\\"', '"').replace("\\\\", "\\")
            if key is None:
                key = s
            else:
                stack[-1][key.lower()] = s
                key = None
    return root


def _read(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return None


def steam_roots(home: str) -> list[str]:
    candidates = [
        os.path.join(home, ".local/share/Steam"),
        os.path.join(home, ".steam/steam"),
        os.path.join(home, ".steam/root"),
    ]
    seen, out = set(), []
    for c in candidates:
        real = os.path.realpath(c)
        if os.path.isdir(real) and real not in seen:
            seen.add(real)
            out.append(real)
    return out


def library_paths(home: str) -> list[str]:
    paths: list[str] = []
    for root in steam_roots(home):
        paths.append(root)
        text = _read(os.path.join(root, "steamapps", "libraryfolders.vdf"))
        if not text:
            continue
        folders = parse_vdf(text).get("libraryfolders", {})
        for entry in folders.values():
            if isinstance(entry, dict) and entry.get("path"):
                paths.append(entry["path"])
            elif isinstance(entry, str) and entry.startswith("/"):
                paths.append(entry)  # very old format: "1" "/path"
    seen, out = set(), []
    for p in paths:
        real = os.path.realpath(p)
        if real not in seen and os.path.isdir(os.path.join(real, "steamapps")):
            seen.add(real)
            out.append(real)
    return out


def is_tool(appid: int, name: str) -> bool:
    if appid in SKIP_APPIDS:
        return True
    lower = name.lower()
    return lower.startswith(SKIP_NAME_PREFIXES)


def installed_games(home: str) -> list[dict]:
    games: dict[int, dict] = {}
    for lib in library_paths(home):
        for manifest in glob.glob(os.path.join(lib, "steamapps", "appmanifest_*.acf")):
            text = _read(manifest)
            if not text:
                continue
            state = parse_vdf(text).get("appstate", {})
            try:
                appid = int(state.get("appid", ""))
            except ValueError:
                continue
            name = (state.get("name") or "").strip() or f"App {appid}"
            if appid <= 0 or is_tool(appid, name):
                continue
            games.setdefault(appid, {"appid": appid, "name": name})
    return sorted(games.values(), key=lambda g: (g["name"].casefold(), g["appid"]))
