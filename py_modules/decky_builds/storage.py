"""Guide files, reading progress and plugin state on disk.

Layout (from the contract):
  {runtime_dir}/guides/{id}.json      one file per guide
  {settings_dir}/progress.json        {guide_id: {"checks": {...}, "last_section": int|None}}
  {settings_dir}/state.json           {"uploads": [...], "auto_stop_minutes": int}
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from typing import Any

from .validator import ID_RE

MAX_UPLOAD_HISTORY = 20
AUTO_STOP_CHOICES = (15, 30, 60, 0)
DEFAULT_AUTO_STOP = 15


def atomic_write_json(path: str, data: Any) -> None:
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _read_json(path: str, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except (OSError, ValueError):
        # A corrupt file should not take the whole plugin down. Keep a copy.
        try:
            os.replace(path, f"{path}.corrupt-{int(time.time())}")
        except OSError:
            pass
        return default


class GuideNotFound(Exception):
    def __init__(self, guide_id: str):
        super().__init__(f"Guide \"{guide_id}\" was not found. It may have been deleted.")


def guide_meta(guide: dict, received_at: float) -> dict:
    game = guide.get("game") or {}
    tags = guide.get("tags")
    return {
        "id": guide["id"],
        "title": guide["title"],
        "appid": game.get("appid"),
        "game_name": game.get("name", ""),
        "author": guide.get("author"),
        "updated": guide.get("updated"),
        "tags": [t for t in tags if isinstance(t, str)] if isinstance(tags, list) else [],
        "summary": guide.get("summary"),
        "section_count": len(guide.get("sections") or []),
        "received_at": int(received_at),
    }


class Storage:
    def __init__(self, runtime_dir: str, settings_dir: str, logger=None):
        self.guides_dir = os.path.join(runtime_dir, "guides")
        self.progress_path = os.path.join(settings_dir, "progress.json")
        self.state_path = os.path.join(settings_dir, "state.json")
        self.log = logger
        self._lock = threading.RLock()
        os.makedirs(self.guides_dir, exist_ok=True)
        os.makedirs(settings_dir, exist_ok=True)
        self._progress: dict = _read_json(self.progress_path, {})
        if not isinstance(self._progress, dict):
            self._progress = {}
        self._state: dict = _read_json(self.state_path, {})
        if not isinstance(self._state, dict):
            self._state = {}

    # -- guides ---------------------------------------------------------------

    def _path(self, guide_id: str) -> str:
        if not isinstance(guide_id, str) or not ID_RE.match(guide_id):
            raise GuideNotFound(str(guide_id))
        return os.path.join(self.guides_dir, f"{guide_id}.json")

    def list_guides(self) -> list[dict]:
        out = []
        with self._lock:
            try:
                names = sorted(os.listdir(self.guides_dir))
            except FileNotFoundError:
                return []
            for name in names:
                if not name.endswith(".json") or name.startswith("."):
                    continue
                path = os.path.join(self.guides_dir, name)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        guide = json.load(f)
                    out.append(guide_meta(guide, os.path.getmtime(path)))
                except (OSError, ValueError, KeyError, TypeError) as e:
                    if self.log:
                        self.log.warning(f"Skipping unreadable guide {name}: {e}")
        out.sort(key=lambda m: (str(m["game_name"]).lower(), str(m["title"]).lower()))
        return out

    def get_guide(self, guide_id: str) -> dict:
        path = self._path(guide_id)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            raise GuideNotFound(guide_id)

    def save_guide(self, guide: dict) -> tuple[dict, bool]:
        """Store a validated guide. Returns (meta, replaced). Progress is kept on replace."""
        with self._lock:
            path = self._path(guide["id"])
            replaced = os.path.exists(path)
            atomic_write_json(path, guide)
            return guide_meta(guide, os.path.getmtime(path)), replaced

    def rename_guide(self, guide_id: str, title: str) -> dict:
        if not isinstance(title, str) or not title.strip():
            raise ValueError("The title can't be empty.")
        title = " ".join(title.split())[:200]
        with self._lock:
            guide = self.get_guide(guide_id)
            guide["title"] = title
            path = self._path(guide_id)
            atomic_write_json(path, guide)
            return guide_meta(guide, os.path.getmtime(path))

    def delete_guide(self, guide_id: str) -> bool:
        with self._lock:
            path = self._path(guide_id)
            try:
                os.remove(path)
            except FileNotFoundError:
                raise GuideNotFound(guide_id)
            if self._progress.pop(guide_id, None) is not None:
                atomic_write_json(self.progress_path, self._progress)
            return True

    # -- progress -------------------------------------------------------------

    def _progress_for(self, guide_id: str) -> dict:
        p = self._progress.get(guide_id)
        if not isinstance(p, dict):
            p = {}
        checks = p.get("checks")
        last = p.get("last_section")
        return {
            "checks": {k: bool(v) for k, v in checks.items()} if isinstance(checks, dict) else {},
            "last_section": last if isinstance(last, int) and not isinstance(last, bool) else None,
        }

    def get_progress(self, guide_id: str) -> dict:
        self._path(guide_id)
        with self._lock:
            return self._progress_for(guide_id)

    def set_check(self, guide_id: str, key: str, value: bool) -> dict:
        if not os.path.exists(self._path(guide_id)):
            raise GuideNotFound(guide_id)
        if not isinstance(key, str) or not key or len(key) > 300:
            raise ValueError("Invalid checklist key.")
        with self._lock:
            p = self._progress_for(guide_id)
            if value:
                p["checks"][key] = True
            else:
                p["checks"].pop(key, None)
            self._progress[guide_id] = p
            atomic_write_json(self.progress_path, self._progress)
            return p

    def set_last_section(self, guide_id: str, index: int) -> dict:
        if not os.path.exists(self._path(guide_id)):
            raise GuideNotFound(guide_id)
        try:
            index = int(index)
        except (TypeError, ValueError):
            raise ValueError("The section index must be a number.")
        with self._lock:
            p = self._progress_for(guide_id)
            if p["last_section"] == index:
                return p
            p["last_section"] = max(0, index)
            self._progress[guide_id] = p
            atomic_write_json(self.progress_path, self._progress)
            return p

    # -- state (uploads, preferences) -----------------------------------------

    def list_uploads(self) -> list[dict]:
        with self._lock:
            ups = self._state.get("uploads")
            return list(ups) if isinstance(ups, list) else []

    def add_upload(self, upload: dict) -> None:
        with self._lock:
            ups = self.list_uploads()
            ups.insert(0, upload)
            self._state["uploads"] = ups[:MAX_UPLOAD_HISTORY]
            atomic_write_json(self.state_path, self._state)

    @property
    def auto_stop_minutes(self) -> int:
        v = self._state.get("auto_stop_minutes")
        return v if v in AUTO_STOP_CHOICES else DEFAULT_AUTO_STOP

    @auto_stop_minutes.setter
    def auto_stop_minutes(self, minutes: int) -> None:
        with self._lock:
            self._state["auto_stop_minutes"] = minutes
            atomic_write_json(self.state_path, self._state)


def normalize_auto_stop(minutes: Any) -> int:
    try:
        m = int(minutes)
    except (TypeError, ValueError):
        raise ValueError("Auto-stop must be 15, 30, 60 or 0 (never).")
    if m not in AUTO_STOP_CHOICES:
        raise ValueError("Auto-stop must be 15, 30, 60 or 0 (never).")
    return m
