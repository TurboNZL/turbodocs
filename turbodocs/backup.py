"""Crash-safe temporary backup of the document being edited."""
import json
import os
import time
import uuid
from pathlib import Path

from PySide6.QtCore import QStandardPaths

from . import docx_io

DIR = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppDataLocation)) / "backups"


def _alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


class Backup:
    """One backup slot per open window; removed on save/clean exit, kept after a crash."""

    def __init__(self):
        self.id = uuid.uuid4().hex
        DIR.mkdir(parents=True, exist_ok=True)

    @property
    def _docx(self):
        return DIR / f"{self.id}.docx"

    @property
    def _meta(self):
        return DIR / f"{self.id}.json"

    def write(self, tabs, styles, original_path):
        tmp = DIR / f"{self.id}.part"
        docx_io.export_docx(tabs, styles, tmp)
        os.replace(tmp, self._docx)
        self._meta.write_text(json.dumps({"path": str(original_path or ""), "pid": os.getpid(),
                                          "time": time.time()}))

    def clear(self):
        for p in (self._docx, self._meta):
            p.unlink(missing_ok=True)


def orphans():
    """Backups left behind by processes that no longer exist, newest first."""
    found = []
    for meta in DIR.glob("*.json") if DIR.exists() else []:
        try:
            info = json.loads(meta.read_text())
        except (OSError, ValueError):
            continue
        docx = meta.with_suffix(".docx")
        if docx.exists() and not _alive(info.get("pid", 0)):
            found.append((info.get("time", 0), docx, meta, info.get("path") or None))
    return sorted(found, reverse=True)
