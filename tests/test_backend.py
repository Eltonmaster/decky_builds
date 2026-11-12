"""Backend tests. Run from the repo root:  python3 -m unittest discover -s tests -v

Uses only the standard library and a stub `decky` module.
"""

import asyncio
import copy
import glob
import json
import logging
import os
import sys
import tempfile
import time
import types
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES = os.path.join(ROOT, "tests", "guides")
sys.path.insert(0, os.path.join(ROOT, "py_modules"))
sys.path.insert(0, ROOT)

from decky_builds import steam  # noqa: E402
from decky_builds.validator import GuideInvalid, parse_and_validate, validate  # noqa: E402


def load(name):
    with open(os.path.join(GUIDES, name), encoding="utf-8") as f:
        return json.load(f)


def messages(guide):
    return [str(e) for e in validate(guide)]


class ValidatorTests(unittest.TestCase):
    def test_examples_are_valid(self):
        files = glob.glob(os.path.join(GUIDES, "*.json"))
        self.assertEqual(len(files), 3)
        for path in files:
            with open(path, "rb") as f:
                parse_and_validate(f.read())

    def test_table_row_length(self):
        g = load("er-bleed-samurai.json")
        g["sections"][1]["blocks"][1]["rows"][3].pop()
        self.assertEqual(messages(g), [
            "sections[1].blocks[1] (table): row 4 has 4 cells, but the table has 5 columns."])

    def test_json_syntax_error_has_line_and_column(self):
        with self.assertRaises(GuideInvalid) as cm:
            parse_and_validate(b'{\n  "format": "decky-builds.guide",\n  "version": 1\n  "id": "x"\n}')
        self.assertTrue(str(cm.exception).startswith("line 4, column 3: invalid JSON"))

    def test_bad_header_fields(self):
        g = load("bal-mime-baron.json")
        g["format"] = "other"
        g["version"] = 2
        g["id"] = "Bad Id"
        g["game"]["appid"] = "2379780"
        g["title"] = " "
        msgs = messages(g)
        self.assertEqual([m.split(":")[0] for m in msgs], ["format", "version", "id", "title", "game.appid"])

    def test_unknown_block_and_span(self):
        g = load("bal-mime-baron.json")
        g["sections"][0]["blocks"].append({"type": "image", "src": "x.png"})
        g["sections"][0]["blocks"][0]["text"][1] = {"u": "Baron"}
        g["sections"][0]["blocks"][2]["text"] = ["Press ", {"btn": "Z"}]
        msgs = messages(g)
        self.assertIn('sections[0].blocks[3].type: unknown block type "image". '
                      'Use one of: text, heading, list, checklist, table, stats, callout.', msgs)
        self.assertTrue(any(m.startswith("sections[0].blocks[0] (text).text[1]: a span needs") for m in msgs))
        self.assertTrue(any(m.startswith('sections[0].blocks[2] (callout).text[1].btn: unknown button "Z"')
                            for m in msgs))

    def test_duplicate_ids(self):
        g = load("er-bleed-samurai.json")
        g["sections"][1]["id"] = "overview"
        route = g["sections"][3]["blocks"][1]
        route["items"][1]["id"] = "twohand"
        g["sections"][0]["blocks"].append(copy.deepcopy(route))
        msgs = messages(g)
        self.assertIn('sections[1].id: "overview" is already used by sections[0].', msgs)
        self.assertIn('sections[3].blocks[1] (checklist).items[1].id: "twohand" is already used by items[0].',
                      msgs)
        self.assertTrue(any("checklist id \"route\" is already used" in m for m in msgs))

    def test_unknown_top_level_fields_are_ignored(self):
        g = load("sdv-spring-y1.json")
        g["cover"] = "something-for-v2"
        self.assertEqual(messages(g), [])

    def test_not_an_object(self):
        self.assertEqual(messages([1, 2]), ["The file must contain a JSON object, got a list."])


class SteamTests(unittest.TestCase):
    def test_installed_games(self):
        with tempfile.TemporaryDirectory() as home:
            steamroot = os.path.join(home, ".local/share/Steam")
            sd = os.path.join(home, "sdcard")
            for lib in (steamroot, sd):
                os.makedirs(os.path.join(lib, "steamapps"))
            with open(os.path.join(steamroot, "steamapps/libraryfolders.vdf"), "w") as f:
                f.write('"libraryfolders"\n{\n  "0"\n  {\n    "path"  "%s"\n    "apps" { "1245620" "1" }\n  }\n'
                        '  "1"\n  {\n    "path"  "%s"\n  }\n}\n' % (steamroot, sd))

            def manifest(lib, appid, name):
                with open(os.path.join(lib, f"steamapps/appmanifest_{appid}.acf"), "w") as f:
                    f.write('"AppState"\n{\n\t"appid"\t\t"%d"\n\t"name"\t\t"%s"\n\t"StateFlags"\t"4"\n}\n'
                            % (appid, name))
            manifest(steamroot, 1245620, "ELDEN RING")
            manifest(steamroot, 1493710, "Proton Experimental")
            manifest(steamroot, 228980, "Steamworks Common Redistributables")
            manifest(steamroot, 1628350, "Steam Linux Runtime 3.0 (sniper)")
            manifest(sd, 413150, "Stardew Valley")
            manifest(sd, 2379780, "Balatro")
            self.assertEqual(steam.installed_games(home), [
                {"appid": 2379780, "name": "Balatro"},
                {"appid": 1245620, "name": "ELDEN RING"},
                {"appid": 413150, "name": "Stardew Valley"},
            ])

    def test_no_steam(self):
        with tempfile.TemporaryDirectory() as home:
            self.assertEqual(steam.installed_games(home), [])


def make_stub_decky(tmp):
    events = []
    mod = types.ModuleType("decky")
    mod.DECKY_PLUGIN_RUNTIME_DIR = os.path.join(tmp, "runtime")
    mod.DECKY_PLUGIN_SETTINGS_DIR = os.path.join(tmp, "settings")
    mod.DECKY_USER_HOME = os.path.join(tmp, "home")
    mod.logger = logging.getLogger("decky-test")

    async def emit(event, *args):
        events.append((event, args[0] if args else None))
    mod.emit = emit
    return mod, events


async def http(port, method, path, body=b"", headers=None):
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    h = {"Host": "x", "Content-Length": str(len(body))}
    h.update(headers or {})
    req = f"{method} {path} HTTP/1.1\r\n" + "".join(f"{k}: {v}\r\n" for k, v in h.items()) + "\r\n"
    writer.write(req.encode() + body)
    await writer.drain()
    data = await reader.read()
    writer.close()
    head, _, payload = data.partition(b"\r\n\r\n")
    status = int(head.split(b" ")[1])
    return status, payload


class PluginTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        stub, self.events = make_stub_decky(self.tmp.name)
        sys.modules["decky"] = stub
        sys.modules.pop("main", None)
        import main
        self.main = main
        self.p = main.Plugin()
        await self.p._main()

    async def asyncTearDown(self):
        await self.p._unload()
        self.tmp.cleanup()

    def event_names(self):
        return [e for e, _ in self.events]

    async def upload(self, name, raw=None, code=None, filename=None):
        if raw is None:
            with open(os.path.join(GUIDES, name), "rb") as f:
                raw = f.read()
        st = await self.p.get_server_status()
        return await http(st["port"], "POST", "/api/upload", raw, {
            "X-Pairing-Code": code if code is not None else st["pairing_code"],
            "X-Filename": filename or name})

    async def test_server_is_off_until_started(self):
        st = await self.p.get_server_status()
        self.assertFalse(st["running"])
        self.assertIsNone(st["pairing_code"])
        self.assertEqual(st["auto_stop_minutes"], 15)

    async def test_full_flow(self):
        st = await self.p.start_server(30)
        self.assertTrue(st["running"])
        self.assertRegex(st["pairing_code"], r"^\d{6}$")
        self.assertTrue(st["url"].startswith("http://"))
        self.assertAlmostEqual(st["stops_at"], time.time() + 30 * 60, delta=5)
        self.assertEqual(self.event_names(), ["server_status"])

        status, page = await http(st["port"], "GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Pairing code", page)

        for name in ("er-bleed-samurai.json", "sdv-spring-y1.json"):
            status, body = await self.upload(name)
            self.assertEqual(status, 200, body)
            self.assertTrue(json.loads(body)["ok"])

        guides = await self.p.list_guides()
        self.assertEqual([g["id"] for g in guides], ["er-bleed-samurai", "sdv-spring-y1"])
        self.assertEqual(guides[0]["appid"], 1245620)
        self.assertEqual(guides[0]["section_count"], 4)
        self.assertIn("upload_received", self.event_names())
        self.assertIn("guides_changed", self.event_names())

        # Broken upload: precise error, recorded in history.
        g = load("bal-mime-baron.json")
        g["sections"][0]["blocks"][1]["rows"][3].append("extra")
        status, body = await self.upload("bal.json", json.dumps(g).encode())
        self.assertEqual(status, 422)
        err = json.loads(body)["errors"][0]
        self.assertEqual(err["path"], "sections[0].blocks[1] (table)")
        self.assertEqual(err["message"], "row 4 has 4 cells, but the table has 3 columns.")
        ups = await self.p.list_uploads()
        self.assertEqual(ups[0]["file"], "bal.json")
        self.assertFalse(ups[0]["ok"])
        self.assertEqual(ups[0]["error"],
                         "sections[0].blocks[1] (table): row 4 has 4 cells, but the table has 3 columns.")
        self.assertTrue(ups[1]["ok"])

        # Non-JSON filename and too-large files.
        status, _ = await self.upload("bal-mime-baron.json", filename="guide.txt")
        self.assertEqual(status, 422)
        status, _ = await self.upload("x.json", raw=b" " * (1024 * 1024 + 1))
        self.assertEqual(status, 413)

        # Progress, replace keeps progress, rename, delete removes it.
        await self.p.set_check("er-bleed-samurai", "route:naga", True)
        prog = await self.p.set_last_section("er-bleed-samurai", 2)
        self.assertEqual(prog, {"checks": {"route:naga": True}, "last_section": 2})
        status, body = await self.upload("er-bleed-samurai.json")
        self.assertTrue(json.loads(body)["replaced"])
        self.assertEqual((await self.p.get_progress("er-bleed-samurai"))["last_section"], 2)
        meta = await self.p.rename_guide("er-bleed-samurai", "  My   bleed build ")
        self.assertEqual(meta["title"], "My bleed build")
        self.assertEqual((await self.p.get_guide("er-bleed-samurai"))["title"], "My bleed build")
        await self.p.set_check("er-bleed-samurai", "route:naga", False)
        self.assertEqual((await self.p.get_progress("er-bleed-samurai"))["checks"], {})
        self.assertTrue(await self.p.delete_guide("er-bleed-samurai"))
        self.assertEqual([g["id"] for g in await self.p.list_guides()], ["sdv-spring-y1"])
        self.assertEqual(await self.p.get_progress("er-bleed-samurai"), {"checks": {}, "last_section": None})
        with self.assertRaises(Exception):
            await self.p.get_guide("er-bleed-samurai")
        with self.assertRaises(ValueError):
            await self.p.rename_guide("sdv-spring-y1", "   ")

        st = await self.p.stop_server()
        self.assertFalse(st["running"])
        self.assertIsNone(st["url"])

    async def test_pairing_code_and_lockout(self):
        st = await self.p.start_server(15)
        wrong = "000000" if st["pairing_code"] != "000000" else "111111"
        for _ in range(5):
            status, _ = await self.upload("sdv-spring-y1.json", code=wrong)
            self.assertEqual(status, 401)
        status, _ = await self.upload("sdv-spring-y1.json", code=wrong)
        self.assertEqual(status, 429)
        status, _ = await self.upload("sdv-spring-y1.json")  # right code, but locked out
        self.assertEqual(status, 429)
        self.assertEqual(await self.p.list_uploads(), [])  # wrong codes are not recorded

    async def test_pair_endpoint_and_spaced_code(self):
        st = await self.p.start_server(15)
        c = st["pairing_code"]
        status, _ = await http(st["port"], "POST", "/api/pair", headers={"X-Pairing-Code": f"{c[:3]} {c[3:]}"})
        self.assertEqual(status, 200)
        status, _ = await http(st["port"], "GET", "/api/upload")
        self.assertEqual(status, 405)
        status, _ = await http(st["port"], "GET", "/nope")
        self.assertEqual(status, 404)

    async def test_new_code_each_start_and_auto_stop(self):
        a = (await self.p.start_server(15))["pairing_code"]
        await self.p.stop_server()
        codes = {a}
        for _ in range(3):
            codes.add((await self.p.start_server(15))["pairing_code"])
            await self.p.stop_server()
        self.assertGreater(len(codes), 1)

        st = await self.p.start_server(0)
        self.assertIsNone(st["stops_at"])
        st = await self.p.set_auto_stop(60)
        self.assertIsNotNone(st["stops_at"])
        with self.assertRaises(ValueError):
            await self.p.set_auto_stop(7)

        # Fire auto-stop quickly.
        self.p._stop_task.cancel()
        self.p._stop_task = asyncio.get_running_loop().create_task(self.p._auto_stop(0.05))
        self.events.clear()
        await asyncio.sleep(0.3)
        self.assertFalse((await self.p.get_server_status())["running"])
        self.assertEqual(self.events[-1][0], "server_status")
        self.assertFalse(self.events[-1][1]["running"])
        # Preference persists across restarts.
        p2 = self.main.Plugin()
        await p2._main()
        self.assertEqual((await p2.get_server_status())["auto_stop_minutes"], 60)

    async def test_port_fallback(self):
        blocker = await asyncio.start_server(lambda r, w: None, "0.0.0.0", 8787)
        try:
            st = await self.p.start_server(15)
            self.assertNotEqual(st["port"], 8787)
        finally:
            blocker.close()

    async def test_bad_ids_cannot_escape_guides_dir(self):
        for bad in ("../state", "a/b", "", None):
            with self.assertRaises(Exception):
                await self.p.get_guide(bad)


if __name__ == "__main__":
    unittest.main()
