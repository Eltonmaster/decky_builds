"""Validation of Decky Builds guide files (format v1).

Every problem is reported with a JSON path such as
``sections[1].blocks[0] (table)`` so the uploader can find it quickly.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

FORMAT = "decky-builds.guide"
VERSION = 1
MAX_ERRORS = 25

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
BUTTONS = {
    "A", "B", "X", "Y", "L1", "R1", "L2", "R2", "L4", "R4", "L5", "R5",
    "START", "SELECT", "DPAD",
}
SPAN_KEYS = ("b", "i", "hl", "btn")
BLOCK_TYPES = ("text", "heading", "list", "checklist", "table", "stats", "callout")
ALIGNS = ("left", "right", "center")
TONES = ("tip", "warning", "note")
LIST_STYLES = ("bullet", "number")


@dataclass
class ValidationError:
    path: str
    message: str

    def as_dict(self) -> dict:
        return {"path": self.path, "message": self.message}

    def __str__(self) -> str:
        return f"{self.path}: {self.message}" if self.path else self.message


class GuideInvalid(Exception):
    def __init__(self, errors: list[ValidationError]):
        self.errors = errors
        super().__init__(summarize(errors))


def summarize(errors: list[ValidationError]) -> str:
    if not errors:
        return ""
    text = str(errors[0])
    if len(errors) > 1:
        text += f" (+{len(errors) - 1} more)"
    return text


def _is_int(v: Any) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _type_name(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true/false"
    if _is_number(v):
        return "a number"
    if isinstance(v, str):
        return "a string"
    if isinstance(v, list):
        return "a list"
    if isinstance(v, dict):
        return "an object"
    return type(v).__name__


class _Checker:
    def __init__(self) -> None:
        self.errors: list[ValidationError] = []

    def err(self, path: str, message: str) -> None:
        if len(self.errors) < MAX_ERRORS:
            self.errors.append(ValidationError(path, message))

    # -- primitives ---------------------------------------------------------

    def string(self, obj: dict, key: str, path: str, *, required: bool = True,
               non_empty: bool = False) -> bool:
        p = f"{path}.{key}" if path else key
        if key not in obj:
            if required:
                self.err(p, "is missing.")
            return False
        v = obj[key]
        if not isinstance(v, str):
            self.err(p, f"must be a string, got {_type_name(v)}.")
            return False
        if non_empty and not v.strip():
            self.err(p, "must not be empty.")
            return False
        return True

    def rich(self, v: Any, path: str) -> None:
        """Rich = string | span | [string | span, ...]"""
        if isinstance(v, str):
            return
        if isinstance(v, dict):
            self.span(v, path)
            return
        if isinstance(v, list):
            if not v:
                self.err(path, "must not be an empty list.")
            for i, part in enumerate(v):
                if isinstance(part, str):
                    continue
                if isinstance(part, dict):
                    self.span(part, f"{path}[{i}]")
                else:
                    self.err(f"{path}[{i}]",
                             f"must be a string or a span like {{\"b\": \"…\"}}, got {_type_name(part)}.")
            return
        self.err(path, f"must be text (a string, a span or a list of them), got {_type_name(v)}.")

    def span(self, v: dict, path: str) -> None:
        keys = list(v.keys())
        if len(keys) != 1 or keys[0] not in SPAN_KEYS:
            shown = ", ".join(f'"{k}"' for k in keys) or "no keys"
            self.err(path, f"a span needs exactly one of \"b\", \"i\", \"hl\", \"btn\"; found {shown}.")
            return
        k = keys[0]
        val = v[k]
        if not isinstance(val, str):
            self.err(f"{path}.{k}", f"must be a string, got {_type_name(val)}.")
            return
        if k == "btn" and val not in BUTTONS:
            self.err(f"{path}.btn",
                     f"unknown button \"{val}\". Use one of: {', '.join(sorted(BUTTONS))}.")

    def obj_list(self, obj: dict, key: str, path: str, *, non_empty: bool = True) -> list | None:
        p = f"{path}.{key}" if path else key
        if key not in obj:
            self.err(p, "is missing.")
            return None
        v = obj[key]
        if not isinstance(v, list):
            self.err(p, f"must be a list, got {_type_name(v)}.")
            return None
        if non_empty and not v:
            self.err(p, "must not be empty.")
        return v

    # -- guide --------------------------------------------------------------

    def guide(self, g: Any) -> None:
        if not isinstance(g, dict):
            self.err("", f"The file must contain a JSON object, got {_type_name(g)}.")
            return

        if g.get("format") != FORMAT:
            self.err("format", f"must be \"{FORMAT}\"." if "format" in g else
                     f"is missing. Add \"format\": \"{FORMAT}\".")
        if "version" not in g:
            self.err("version", f"is missing. Add \"version\": {VERSION}.")
        elif not _is_int(g["version"]) or g["version"] != VERSION:
            self.err("version", f"must be {VERSION}, got {json.dumps(g['version'])}.")

        if self.string(g, "id", ""):
            if not ID_RE.match(g["id"]):
                self.err("id", "must be 1–64 lowercase letters, digits or dashes, "
                               f"starting with a letter or digit (got \"{g['id']}\").")
        self.string(g, "title", "", non_empty=True)

        game = g.get("game")
        if game is None:
            self.err("game", "is missing. Add \"game\": {\"appid\": 123, \"name\": \"…\"}.")
        elif not isinstance(game, dict):
            self.err("game", f"must be an object, got {_type_name(game)}.")
        else:
            if "appid" not in game:
                self.err("game.appid", "is missing.")
            elif not _is_int(game["appid"]) or game["appid"] <= 0:
                self.err("game.appid", f"must be a positive whole number (the Steam app id), "
                                       f"got {json.dumps(game['appid'])}.")
            self.string(game, "name", "game", non_empty=True)

        self.string(g, "author", "", required=False)
        if self.string(g, "updated", "", required=False) and not DATE_RE.match(g["updated"]):
            self.err("updated", f"must be a date like 2026-11-12, got \"{g['updated']}\".")
        if "tags" in g:
            tags = g["tags"]
            if not isinstance(tags, list):
                self.err("tags", f"must be a list of strings, got {_type_name(tags)}.")
            else:
                for i, t in enumerate(tags):
                    if not isinstance(t, str):
                        self.err(f"tags[{i}]", f"must be a string, got {_type_name(t)}.")
        self.string(g, "summary", "", required=False)

        sections = self.obj_list(g, "sections", "")
        if sections is None:
            return
        seen_sections: dict[str, int] = {}
        checklist_ids: dict[str, str] = {}
        for si, sec in enumerate(sections):
            sp = f"sections[{si}]"
            if not isinstance(sec, dict):
                self.err(sp, f"must be an object, got {_type_name(sec)}.")
                continue
            if self.string(sec, "id", sp, non_empty=True):
                sid = sec["id"]
                if sid in seen_sections:
                    self.err(f"{sp}.id", f"\"{sid}\" is already used by sections[{seen_sections[sid]}].")
                else:
                    seen_sections[sid] = si
            self.string(sec, "title", sp, non_empty=True)
            blocks = self.obj_list(sec, "blocks", sp)
            if blocks is None:
                continue
            for bi, block in enumerate(blocks):
                self.block(block, f"{sp}.blocks[{bi}]", checklist_ids)

    # -- blocks -------------------------------------------------------------

    def block(self, b: Any, path: str, checklist_ids: dict[str, str]) -> None:
        if not isinstance(b, dict):
            self.err(path, f"must be an object, got {_type_name(b)}.")
            return
        t = b.get("type")
        if t is None:
            self.err(path, f"is missing \"type\". Use one of: {', '.join(BLOCK_TYPES)}.")
            return
        if t not in BLOCK_TYPES:
            self.err(f"{path}.type", f"unknown block type {json.dumps(t)}. "
                                     f"Use one of: {', '.join(BLOCK_TYPES)}.")
            return
        p = f"{path} ({t})"
        getattr(self, f"block_{t}")(b, p, checklist_ids)

    def _rich_field(self, b: dict, key: str, path: str, required: bool = True) -> None:
        if key not in b:
            if required:
                self.err(f"{path}.{key}", "is missing.")
            return
        self.rich(b[key], f"{path}.{key}")

    def block_text(self, b, p, _):
        self._rich_field(b, "text", p)

    def block_heading(self, b, p, _):
        self._rich_field(b, "text", p)

    def block_list(self, b, p, _):
        if "style" in b and b["style"] not in LIST_STYLES:
            self.err(f"{p}.style", f"must be \"bullet\" or \"number\", got {json.dumps(b['style'])}.")
        items = self.obj_list(b, "items", p)
        for i, it in enumerate(items or []):
            self.rich(it, f"{p}.items[{i}]")

    def block_checklist(self, b, p, checklist_ids):
        cid = None
        if self.string(b, "id", p, non_empty=True):
            cid = b["id"]
            if ":" in cid:
                self.err(f"{p}.id", "must not contain \":\".")
            elif cid in checklist_ids:
                self.err(f"{p}.id", f"checklist id \"{cid}\" is already used at {checklist_ids[cid]}.")
            else:
                checklist_ids[cid] = p
        items = self.obj_list(b, "items", p)
        seen: dict[str, int] = {}
        for i, it in enumerate(items or []):
            ip = f"{p}.items[{i}]"
            if not isinstance(it, dict):
                self.err(ip, f"must be an object like {{\"id\": \"…\", \"text\": \"…\"}}, got {_type_name(it)}.")
                continue
            if self.string(it, "id", ip, non_empty=True):
                iid = it["id"]
                if ":" in iid:
                    self.err(f"{ip}.id", "must not contain \":\".")
                elif iid in seen:
                    self.err(f"{ip}.id", f"\"{iid}\" is already used by items[{seen[iid]}].")
                else:
                    seen[iid] = i
            self._rich_field(it, "text", ip)

    def block_table(self, b, p, _):
        self.string(b, "caption", p, required=False)
        if "stickyFirstColumn" in b and not isinstance(b["stickyFirstColumn"], bool):
            self.err(f"{p}.stickyFirstColumn", "must be true or false.")
        cols = self.obj_list(b, "columns", p)
        ncols = None
        if cols is not None:
            ncols = len(cols)
            for ci, c in enumerate(cols):
                cp = f"{p}.columns[{ci}]"
                if not isinstance(c, dict):
                    self.err(cp, f"must be an object like {{\"label\": \"…\"}}, got {_type_name(c)}.")
                    continue
                self.string(c, "label", cp)
                if "align" in c and c["align"] not in ALIGNS:
                    self.err(f"{cp}.align", f"must be \"left\", \"right\" or \"center\", "
                                            f"got {json.dumps(c['align'])}.")
        rows = self.obj_list(b, "rows", p)
        for ri, row in enumerate(rows or []):
            rp = f"{p}.rows[{ri}]"
            if not isinstance(row, list):
                self.err(rp, f"must be a list of cells, got {_type_name(row)}.")
                continue
            if ncols is not None and ncols and len(row) != ncols:
                self.err(p, f"row {ri + 1} has {len(row)} cell{'s' if len(row) != 1 else ''}, "
                            f"but the table has {ncols} column{'s' if ncols != 1 else ''}.")
            for ci, cell in enumerate(row):
                if _is_number(cell) or isinstance(cell, str):
                    continue
                if isinstance(cell, (dict, list)):
                    self.rich(cell, f"{rp}[{ci}]")
                else:
                    self.err(f"{rp}[{ci}]", f"must be text or a number, got {_type_name(cell)}.")

    def block_stats(self, b, p, _):
        items = self.obj_list(b, "items", p)
        for i, it in enumerate(items or []):
            ip = f"{p}.items[{i}]"
            if not isinstance(it, dict):
                self.err(ip, f"must be an object like {{\"label\": \"…\", \"value\": \"…\"}}, "
                             f"got {_type_name(it)}.")
                continue
            self.string(it, "label", ip)
            if "value" not in it:
                self.err(f"{ip}.value", "is missing.")
            elif not (isinstance(it["value"], str) or _is_number(it["value"])):
                self.err(f"{ip}.value", f"must be a string, got {_type_name(it['value'])}.")

    def block_callout(self, b, p, _):
        if "tone" not in b:
            self.err(f"{p}.tone", "is missing. Use \"tip\", \"warning\" or \"note\".")
        elif b["tone"] not in TONES:
            self.err(f"{p}.tone", f"must be \"tip\", \"warning\" or \"note\", got {json.dumps(b['tone'])}.")
        self.string(b, "title", p, required=False)
        self._rich_field(b, "text", p)


def validate(guide: Any) -> list[ValidationError]:
    """Return a list of problems (empty when the guide is valid)."""
    c = _Checker()
    c.guide(guide)
    return c.errors


def parse_and_validate(raw: bytes) -> dict:
    """Decode, parse and validate an uploaded file. Raises GuideInvalid."""
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        raise GuideInvalid([ValidationError("", f"The file is not UTF-8 text (byte {e.start}).")])
    if not text.strip():
        raise GuideInvalid([ValidationError("", "The file is empty.")])
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise GuideInvalid([ValidationError(f"line {e.lineno}, column {e.colno}",
                                            f"invalid JSON: {e.msg}.")])
    errors = validate(data)
    if errors:
        raise GuideInvalid(errors)
    return data
