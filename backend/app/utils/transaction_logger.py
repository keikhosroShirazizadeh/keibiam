import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from app.config import settings

_SENSITIVE_KEYS = {"hashed_password", "password"}


def _log_dir() -> Path:
    path = Path(settings.LOG_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _log_file_for(day: date) -> Path:
    return _log_dir() / f"transactions_{day.isoformat()}.jsonl"


def _sanitize(data: dict) -> dict:
    return {k: v for k, v in data.items() if k not in _SENSITIVE_KEYS}


def log_transaction(
    action: str,
    collection: str,
    document_id: str,
    data: dict,
    actor_id: Optional[str] = None,
) -> None:
    """Append one structured JSON line describing a DB write.

    Written as JSONL (one JSON object per line) to a per-day file so it can
    be tailed/greped/parsed without loading the whole log into memory.
    """
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "collection": collection,
        "document_id": document_id,
        "actor_id": actor_id,
        "data": _sanitize(data),
    }
    with open(_log_file_for(date.today()), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")


def query_transactions(
    day: Optional[date] = None,
    collection: Optional[str] = None,
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Read and filter the log for a single day (defaults to today).

    Only today's file is written for now; querying other days is already
    supported here (pass `day`) so extending retention later needs no
    changes beyond writing/keeping more daily files.
    """
    path = _log_file_for(day or date.today())
    if not path.exists():
        return []

    results = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if collection and entry["collection"] != collection:
                continue
            if action and entry["action"] != action:
                continue
            if actor_id and entry["actor_id"] != actor_id:
                continue
            results.append(entry)
    return results[-limit:]
