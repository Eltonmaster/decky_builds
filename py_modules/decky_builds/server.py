"""The opt-in upload server: a tiny HTTP/1.1 server on stdlib asyncio.

It only exists between start() and stop(). It serves the upload page and
accepts JSON guide files guarded by a 6-digit pairing code.
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import secrets
import socket
import time
from collections import deque
from typing import Awaitable, Callable

MAX_BODY = 1024 * 1024  # 1 MB
MAX_HEADER_BYTES = 16 * 1024
WRONG_CODE_LIMIT = 5        # per client IP, per window
WRONG_CODE_GLOBAL_LIMIT = 20  # across all clients, per window
WRONG_CODE_WINDOW = 60.0
HEADER_TIMEOUT = 10.0
BODY_TIMEOUT = 30.0
DEFAULT_PORT = 8787
PORT_ATTEMPTS = 20

STATUS_TEXT = {
    200: "OK", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found",
    405: "Method Not Allowed", 408: "Request Timeout", 411: "Length Required",
    413: "Payload Too Large", 422: "Unprocessable Entity", 429: "Too Many Requests",
    431: "Request Header Fields Too Large", 500: "Internal Server Error",
}

# handler(filename, raw_bytes) -> (http_status, json_body)
UploadHandler = Callable[[str, bytes], Awaitable[tuple[int, dict]]]


def lan_ipv4() -> str | None:
    """Best guess at the Deck's address on the local network."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No packet is sent; this only asks the kernel which interface it would use.
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        if ip and not ip.startswith("127."):
            return ip
    except OSError:
        pass
    finally:
        s.close()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                return ip
    except OSError:
        pass
    return None


def new_pairing_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class UploadServer:
    def __init__(self, page_path: str, on_upload: UploadHandler, logger=None):
        self.page_path = page_path
        self.on_upload = on_upload
        self.log = logger
        self._server: asyncio.base_events.Server | None = None
        self.port: int | None = None
        self.pairing_code: str | None = None
        self._fails: dict[str, deque] = {}
        self._global_fails: deque = deque()

    @property
    def running(self) -> bool:
        return self._server is not None

    @property
    def url(self) -> str | None:
        if not self.running:
            return None
        ip = lan_ipv4() or "steamdeck.local"
        return f"http://{ip}:{self.port}"

    async def start(self, port: int = DEFAULT_PORT) -> None:
        if self._server is not None:
            return
        last_err: OSError | None = None
        for p in range(port, port + PORT_ATTEMPTS):
            try:
                self._server = await asyncio.start_server(
                    self._handle, host="0.0.0.0", port=p, reuse_address=True,
                    limit=MAX_HEADER_BYTES)
                self.port = p
                break
            except OSError as e:
                last_err = e
        if self._server is None:
            raise RuntimeError(f"No free port between {port} and {port + PORT_ATTEMPTS - 1}: {last_err}")
        self.pairing_code = new_pairing_code()
        self._fails.clear()
        self._global_fails.clear()
        if self.log:
            self.log.info(f"Upload server listening on port {self.port}")

    async def stop(self) -> None:
        srv, self._server = self._server, None
        self.port = None
        self.pairing_code = None
        if srv is not None:
            srv.close()
            try:
                await asyncio.wait_for(srv.wait_closed(), timeout=3)
            except (asyncio.TimeoutError, Exception):
                pass
            if self.log:
                self.log.info("Upload server stopped")

    # -- rate limiting --------------------------------------------------------

    def _prune(self, q: deque, now: float) -> None:
        while q and now - q[0] > WRONG_CODE_WINDOW:
            q.popleft()

    def _locked_out(self, ip: str) -> bool:
        now = time.monotonic()
        q = self._fails.get(ip)
        if q is not None:
            self._prune(q, now)
        self._prune(self._global_fails, now)
        return (q is not None and len(q) >= WRONG_CODE_LIMIT) or \
            len(self._global_fails) >= WRONG_CODE_GLOBAL_LIMIT

    def _record_fail(self, ip: str) -> None:
        now = time.monotonic()
        self._fails.setdefault(ip, deque()).append(now)
        self._global_fails.append(now)

    def _code_ok(self, given: str | None) -> bool:
        code = self.pairing_code
        if not code or given is None:
            return False
        given = "".join(given.split())  # allow "481 729"
        return hmac.compare_digest(given.encode(), code.encode())

    # -- HTTP -----------------------------------------------------------------

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer = writer.get_extra_info("peername")
        ip = peer[0] if peer else "?"
        try:
            try:
                head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), HEADER_TIMEOUT)
            except asyncio.TimeoutError:
                return await self._send(writer, 408, {"ok": False, "error": "Request timed out."})
            except asyncio.LimitOverrunError:
                return await self._send(writer, 431, {"ok": False, "error": "Headers too large."})
            except asyncio.IncompleteReadError:
                return
            try:
                lines = head.decode("latin-1").split("\r\n")
                method, target, _ = lines[0].split(" ", 2)
            except ValueError:
                return await self._send(writer, 400, {"ok": False, "error": "Bad request."})
            headers: dict[str, str] = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()
            path = target.split("?", 1)[0]
            await self._route(method.upper(), path, headers, reader, writer, ip)
        except (ConnectionError, asyncio.IncompleteReadError):
            pass
        except Exception as e:  # never let one request kill the server
            if self.log:
                self.log.exception(f"Upload server error: {e}")
            try:
                await self._send(writer, 500, {"ok": False, "error": "Internal error."})
            except Exception:
                pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def _route(self, method, path, headers, reader, writer, ip) -> None:
        if path in ("/", "/index.html"):
            if method not in ("GET", "HEAD"):
                return await self._send(writer, 405, {"ok": False, "error": "Use GET."})
            return await self._send_page(writer, head_only=(method == "HEAD"))

        if path == "/api/pair":
            if method != "POST":
                return await self._send(writer, 405, {"ok": False, "error": "Use POST."})
            auth = self._authorize(headers, ip)
            if auth != "ok":
                await _discard_body(reader, headers)
                return await self._send_auth_error(writer, auth)
            await _discard_body(reader, headers)
            return await self._send(writer, 200, {"ok": True})

        if path == "/api/upload":
            if method != "POST":
                return await self._send(writer, 405, {"ok": False, "error": "Use POST."})
            auth = self._authorize(headers, ip)
            if auth != "ok":
                await _discard_body(reader, headers)
                return await self._send_auth_error(writer, auth)
            if "chunked" in headers.get("transfer-encoding", "").lower():
                return await self._send(writer, 411, {"ok": False, "error": "Send a Content-Length."})
            try:
                length = int(headers.get("content-length", ""))
            except ValueError:
                return await self._send(writer, 411, {"ok": False, "error": "Send a Content-Length."})
            if length < 0:
                return await self._send(writer, 400, {"ok": False, "error": "Bad Content-Length."})
            if length > MAX_BODY:
                await _discard_body(reader, headers)
                return await self._send(writer, 413, {
                    "ok": False, "error": f"The file is {length / 1024 / 1024:.1f} MB; the limit is 1 MB."})
            try:
                body = await asyncio.wait_for(reader.readexactly(length), BODY_TIMEOUT)
            except asyncio.TimeoutError:
                return await self._send(writer, 408, {"ok": False, "error": "Upload timed out."})
            filename = _clean_filename(headers.get("x-filename", ""))
            status, payload = await self.on_upload(filename, body)
            return await self._send(writer, status, payload)

        return await self._send(writer, 404, {"ok": False, "error": "Not found."})

    def _authorize(self, headers: dict, ip: str) -> str:
        """Returns "ok", "wrong" or "locked"."""
        if self._locked_out(ip):
            return "locked"
        if self._code_ok(headers.get("x-pairing-code")):
            return "ok"
        self._record_fail(ip)
        return "wrong"

    async def _send_auth_error(self, writer, auth: str) -> None:
        if auth == "locked":
            return await self._send(writer, 429, {
                "ok": False, "error": "Too many wrong pairing codes. Wait a minute and try again."})
        return await self._send(writer, 401, {
            "ok": False, "error": "Wrong pairing code. Check the code shown on your Deck."})

    async def _send_page(self, writer, head_only=False) -> None:
        try:
            with open(self.page_path, "rb") as f:
                body = f.read()
        except OSError:
            body = b"<!doctype html><title>Decky Builds</title><p>Upload page missing.</p>"
        await self._write(writer, 200, body, "text/html; charset=utf-8", head_only)

    async def _send(self, writer, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        await self._write(writer, status, body, "application/json; charset=utf-8")

    async def _write(self, writer, status, body: bytes, ctype: str, head_only=False) -> None:
        head = (
            f"HTTP/1.1 {status} {STATUS_TEXT.get(status, 'OK')}\r\n"
            f"Content-Type: {ctype}\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Cache-Control: no-store\r\n"
            "X-Content-Type-Options: nosniff\r\n"
            "Referrer-Policy: no-referrer\r\n"
            "Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'\r\n"
            "Connection: close\r\n\r\n"
        ).encode("latin-1")
        writer.write(head if head_only else head + body)
        await writer.drain()


MAX_DISCARD = 8 * MAX_BODY


async def _discard_body(reader: asyncio.StreamReader, headers: dict) -> None:
    """Read and drop a request body we are refusing, so the client sees our
    response instead of a connection reset. Gives up on absurd sizes."""
    try:
        remaining = int(headers.get("content-length", "0"))
    except ValueError:
        return
    if remaining <= 0 or remaining > MAX_DISCARD:
        return
    try:
        while remaining > 0:
            chunk = await asyncio.wait_for(reader.read(min(remaining, 65536)), BODY_TIMEOUT)
            if not chunk:
                return
            remaining -= len(chunk)
    except (asyncio.TimeoutError, ConnectionError):
        return


def _clean_filename(name: str) -> str:
    try:
        from urllib.parse import unquote
        name = unquote(name)
    except Exception:
        pass
    name = os.path.basename(name.replace("\\", "/")).strip()
    name = "".join(ch for ch in name if ch.isprintable())
    return name[:120] or "upload.json"
