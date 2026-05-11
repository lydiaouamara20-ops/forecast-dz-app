import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "forecast_dz.db"


def get_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def json_loads(value: Optional[str], default: Any = None) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS forecasts (
                id TEXT PRIMARY KEY,
                name TEXT,
                model TEXT,
                forecast_type TEXT,
                study_type TEXT,
                file_name TEXT,
                sector TEXT,
                metrics_json TEXT,
                forecast_json TEXT NOT NULL,
                integration_json TEXT,
                report_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def save_forecast_record(
    forecast: Dict[str, Any],
    integration: Optional[Dict[str, Any]] = None,
    report: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    forecast_id = str(forecast.get("id") or uuid.uuid4())
    now = get_now_iso()

    name = forecast.get("name") or forecast.get("forecast_name") or "Forecast"
    model = forecast.get("model") or forecast.get("selected_model") or forecast.get("best_model")
    forecast_type = forecast.get("type") or forecast.get("forecast_type")
    study_type = forecast.get("studyType") or forecast.get("study_type")
    file_name = forecast.get("fileName") or forecast.get("file_name")
    sector = forecast.get("sector")

    metrics = forecast.get("metrics")

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, created_at FROM forecasts WHERE id = ?",
            (forecast_id,),
        ).fetchone()

        created_at = existing["created_at"] if existing else now

        connection.execute(
            """
            INSERT INTO forecasts (
                id,
                name,
                model,
                forecast_type,
                study_type,
                file_name,
                sector,
                metrics_json,
                forecast_json,
                integration_json,
                report_json,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                model = excluded.model,
                forecast_type = excluded.forecast_type,
                study_type = excluded.study_type,
                file_name = excluded.file_name,
                sector = excluded.sector,
                metrics_json = excluded.metrics_json,
                forecast_json = excluded.forecast_json,
                integration_json = excluded.integration_json,
                report_json = excluded.report_json,
                updated_at = excluded.updated_at
            """,
            (
                forecast_id,
                name,
                model,
                forecast_type,
                study_type,
                file_name,
                sector,
                json_dumps(metrics),
                json_dumps(forecast),
                json_dumps(integration),
                json_dumps(report),
                created_at,
                now,
            ),
        )
        connection.commit()

    return get_forecast_record(forecast_id)


def list_forecast_records() -> List[Dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                name,
                model,
                forecast_type,
                study_type,
                file_name,
                sector,
                metrics_json,
                created_at,
                updated_at
            FROM forecasts
            ORDER BY created_at DESC
            """
        ).fetchall()

    return [
        {
            "id": row["id"],
            "name": row["name"],
            "model": row["model"],
            "type": row["forecast_type"],
            "study_type": row["study_type"],
            "file_name": row["file_name"],
            "sector": row["sector"],
            "metrics": json_loads(row["metrics_json"], {}),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


def get_forecast_record(forecast_id: str) -> Dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM forecasts WHERE id = ?",
            (forecast_id,),
        ).fetchone()

    if not row:
        raise ValueError("Forecast record not found.")

    return {
        "id": row["id"],
        "name": row["name"],
        "model": row["model"],
        "type": row["forecast_type"],
        "study_type": row["study_type"],
        "file_name": row["file_name"],
        "sector": row["sector"],
        "metrics": json_loads(row["metrics_json"], {}),
        "forecast": json_loads(row["forecast_json"], {}),
        "integration": json_loads(row["integration_json"], None),
        "report": json_loads(row["report_json"], None),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def delete_forecast_record(forecast_id: str) -> Dict[str, Any]:
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM forecasts WHERE id = ?",
            (forecast_id,),
        )
        connection.commit()

    if cursor.rowcount == 0:
        raise ValueError("Forecast record not found.")

    return {
        "deleted": True,
        "id": forecast_id,
    }