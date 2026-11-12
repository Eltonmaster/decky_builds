"""Decky Builds backend.

Callables and events follow docs/contract.md. Nothing listens on the network
until the user turns on "Accept file uploads" (start_server).
"""

import asyncio
import os
import sys
import time

import decky  # provided by Decky Loader

# Decky adds py_modules to sys.path; keep this for running outside Decky too.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "py_modules"))

from decky_builds import steam  # noqa: E402
from decky_builds.server import UploadServer  # noqa: E402
from decky_builds.storage import GuideNotFound, Storage, normalize_auto_stop  # noqa: E402
from decky_builds.validator import GuideInvalid, ValidationError, parse_and_validate, summarize  # noqa: E402

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
# The Decky CLI copies defaults/* into the plugin root when packaging, so the
# page is at upload/index.html in a built plugin and defaults/upload/ in the repo.
UPLOAD_PAGE = next(
    (p for p in (os.path.join(PLUGIN_DIR, "upload", "index.html"),
                 os.path.join(PLUGIN_DIR, "defaults", "upload", "index.html")) if os.path.exists(p)),
    os.path.join(PLUGIN_DIR, "upload", "index.html"))


class Plugin:
    storage: Storage = None
    server: UploadServer = None
    stops_at: float | None = None
    _stop_task: asyncio.Task | None = None

    # -- lifecycle ------------------------------------------------------------

    async def _main(self):
        self.storage = Storage(decky.DECKY_PLUGIN_RUNTIME_DIR, decky.DECKY_PLUGIN_SETTINGS_DIR,
                               decky.logger)
        self.server = UploadServer(UPLOAD_PAGE, self._on_upload, decky.logger)
        self.stops_at = None
        self._stop_task = None
        decky.logger.info("Decky Builds backend loaded (upload server is off)")

    async def _unload(self):
        await self._shutdown_server(emit=False)
        decky.logger.info("Decky Builds backend unloaded")

    async def _uninstall(self):
        await self._shutdown_server(emit=False)

    # -- upload server --------------------------------------------------------

    def _status(self) -> dict:
        s = self.server
        running = bool(s and s.running)
        return {
            "running": running,
            "url": s.url if running else None,
            "port": s.port if running else None,
            "pairing_code": s.pairing_code if running else None,
            "auto_stop_minutes": self.storage.auto_stop_minutes,
            "stops_at": int(self.stops_at) if running and self.stops_at else None,
        }

    async def _emit_status(self) -> dict:
        status = self._status()
        await decky.emit("server_status", status)
        return status

    def _arm_timer(self) -> None:
        if self._stop_task is not None:
            self._stop_task.cancel()
            self._stop_task = None
        minutes = self.storage.auto_stop_minutes
        if not (self.server and self.server.running) or minutes == 0:
            self.stops_at = None
            return
        self.stops_at = time.time() + minutes * 60
        self._stop_task = asyncio.get_running_loop().create_task(self._auto_stop(minutes * 60))

    async def _auto_stop(self, delay: float) -> None:
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            return
        self._stop_task = None  # don't cancel ourselves in _shutdown_server
        decky.logger.info("Upload server auto-stopped")
        await self._shutdown_server(emit=True)

    async def _shutdown_server(self, emit: bool) -> None:
        if self._stop_task is not None:
            self._stop_task.cancel()
            self._stop_task = None
        self.stops_at = None
        if self.server and self.server.running:
            await self.server.stop()
            if emit:
                await self._emit_status()

    async def get_server_status(self) -> dict:
        return self._status()

    async def start_server(self, auto_stop_minutes: int = 15) -> dict:
        self.storage.auto_stop_minutes = normalize_auto_stop(auto_stop_minutes)
        if not self.server.running:
            await self.server.start()
        self._arm_timer()
        return await self._emit_status()

    async def stop_server(self) -> dict:
        await self._shutdown_server(emit=False)
        return await self._emit_status()

    async def set_auto_stop(self, minutes: int) -> dict:
        self.storage.auto_stop_minutes = normalize_auto_stop(minutes)
        self._arm_timer()
        return await self._emit_status()

    async def _on_upload(self, filename: str, raw: bytes) -> tuple[int, dict]:
        record = {"file": filename, "received_at": int(time.time()), "ok": False,
                  "guide_id": None, "error": None}
        try:
            if not filename.lower().endswith(".json"):
                raise GuideInvalid([ValidationError("", "Only .json files are accepted.")])
            guide = parse_and_validate(raw)
            meta, replaced = self.storage.save_guide(guide)
        except GuideInvalid as e:
            record["error"] = summarize(e.errors)
            await self._record_upload(record)
            return 422, {"ok": False, "errors": [err.as_dict() for err in e.errors]}
        except Exception as e:
            decky.logger.exception("Saving upload failed")
            record["error"] = f"Could not save the guide on the Deck: {e}"
            await self._record_upload(record)
            return 500, {"ok": False, "errors": [{"path": "", "message": record["error"]}]}

        record.update(ok=True, guide_id=meta["id"])
        await self._record_upload(record)
        await self._emit_guides()
        decky.logger.info(f"Guide {'replaced' if replaced else 'added'}: {meta['id']} ({filename})")
        return 200, {"ok": True, "guide_id": meta["id"], "replaced": replaced,
                     "title": meta["title"], "game_name": meta["game_name"]}

    async def _record_upload(self, record: dict) -> None:
        self.storage.add_upload(record)
        await decky.emit("upload_received", record)

    async def list_uploads(self) -> list:
        return self.storage.list_uploads()

    # -- games ----------------------------------------------------------------

    async def list_installed_games(self) -> list:
        return await asyncio.get_running_loop().run_in_executor(
            None, steam.installed_games, decky.DECKY_USER_HOME)

    # -- guides ---------------------------------------------------------------

    async def _emit_guides(self) -> None:
        await decky.emit("guides_changed", self.storage.list_guides())

    async def list_guides(self) -> list:
        return self.storage.list_guides()

    async def get_guide(self, guide_id: str) -> dict:
        return self.storage.get_guide(guide_id)

    async def rename_guide(self, guide_id: str, title: str) -> dict:
        meta = self.storage.rename_guide(guide_id, title)
        await self._emit_guides()
        return meta

    async def delete_guide(self, guide_id: str) -> bool:
        self.storage.delete_guide(guide_id)
        await self._emit_guides()
        return True

    # -- progress -------------------------------------------------------------

    async def get_progress(self, guide_id: str) -> dict:
        return self.storage.get_progress(guide_id)

    async def set_check(self, guide_id: str, key: str, value: bool) -> dict:
        return self.storage.set_check(guide_id, key, bool(value))

    async def set_last_section(self, guide_id: str, index: int) -> dict:
        return self.storage.set_last_section(guide_id, index)


__all__ = ["Plugin", "GuideNotFound"]
