from typing import Any, Dict, List, Optional


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _float_list(values: Any) -> List[float]:
    if not isinstance(values, list):
        return []

    cleaned: List[float] = []
    for value in values:
        number = _safe_float(value)
        if number is not None:
            cleaned.append(number)

    return cleaned


def _normalize_metrics(metrics: Any) -> Dict[str, Optional[float]]:
    if not isinstance(metrics, dict):
        return {
            "mae": None,
            "rmse": None,
            "mse": None,
        }

    return {
        "mae": _safe_float(metrics.get("mae")),
        "rmse": _safe_float(metrics.get("rmse")),
        "mse": _safe_float(metrics.get("mse")),
    }


def _normalize_ranking(ranking: Any) -> List[Dict[str, Any]]:
    if not isinstance(ranking, list):
        return []

    cleaned: List[Dict[str, Any]] = []

    for index, item in enumerate(ranking, start=1):
        if not isinstance(item, dict):
            continue

        cleaned.append(
            {
                "rank": index,
                "model": item.get("model"),
                "mae": _safe_float(item.get("mae")),
                "rmse": _safe_float(item.get("rmse")),
                "mse": _safe_float(item.get("mse")),
            }
        )

    return cleaned


def _get_model_name(result: Dict[str, Any]) -> str:
    return (
        result.get("best_model")
        or result.get("selected_model")
        or result.get("model")
        or "Unknown model"
    )


def build_fiddler_payload(
    result: Dict[str, Any],
    sector: Optional[str] = None,
    study_type: str = "univariate",
    mode: str = "automatic",
) -> Dict[str, Any]:
    model_name = _get_model_name(result)

    actual_series = _float_list(result.get("actual_series", []))
    predicted_series = _float_list(result.get("predicted_series", []))
    future_predictions = _float_list(result.get("future_predictions", []))

    residuals: List[float] = []
    absolute_errors: List[float] = []

    for actual, predicted in zip(actual_series, predicted_series):
        residual = actual - predicted
        residuals.append(residual)
        absolute_errors.append(abs(residual))

    return {
        "platform": "Fiddler AI",
        "purpose": "analysis_and_interpretation",
        "status": "prepared_only",
        "sector": sector,
        "forecast_context": {
            "model_name": model_name,
            "study_type": study_type,
            "mode": mode,
        },
        "metrics": _normalize_metrics(result.get("metrics", {})),
        "ranking": _normalize_ranking(result.get("ranking", [])),
        "series": {
            "actual": actual_series,
            "predicted": predicted_series,
            "future_predictions": future_predictions,
            "residuals": residuals,
            "absolute_errors": absolute_errors,
        },
        "interpretation_targets": [
            "model_performance",
            "prediction_error",
            "forecast_reliability",
            "model_ranking",
            "future_forecast_behavior",
        ],
        "note": (
            "This payload is ready for future Fiddler AI API integration. "
            "Actual sending requires Fiddler credentials and project configuration."
        ),
    }


def build_datarobot_payload(
    result: Dict[str, Any],
    sector: Optional[str] = None,
    study_type: str = "univariate",
    mode: str = "automatic",
) -> Dict[str, Any]:
    model_name = _get_model_name(result)

    metrics = _normalize_metrics(result.get("metrics", {}))
    ranking = _normalize_ranking(result.get("ranking", []))
    future_predictions = _float_list(result.get("future_predictions", []))

    decision_signal = "neutral"
    recommendation = "Review forecast results before making an operational decision."

    if future_predictions:
        first_value = future_predictions[0]
        last_value = future_predictions[-1]

        if last_value > first_value:
            decision_signal = "upward_forecast"
            recommendation = (
                "The forecast shows an upward tendency. "
                "Consider preparing for higher expected values."
            )
        elif last_value < first_value:
            decision_signal = "downward_forecast"
            recommendation = (
                "The forecast shows a downward tendency. "
                "Consider reducing exposure or reviewing demand assumptions."
            )
        else:
            decision_signal = "stable_forecast"
            recommendation = (
                "The forecast appears stable. "
                "Maintain current planning while monitoring model error."
            )

    return {
        "platform": "DataRobot",
        "purpose": "decision_guidance",
        "status": "prepared_only",
        "sector": sector,
        "forecast_context": {
            "model_name": model_name,
            "study_type": study_type,
            "mode": mode,
        },
        "metrics": metrics,
        "ranking": ranking,
        "future_predictions": future_predictions,
        "decision_support": {
            "signal": decision_signal,
            "recommendation": recommendation,
            "confidence_note": (
                "Decision confidence should be reviewed together with MAE, RMSE, MSE, "
                "business context, and data quality."
            ),
        },
        "note": (
            "This payload is ready for future DataRobot API integration. "
            "Actual sending requires DataRobot credentials, deployment configuration, "
            "or a registered model workflow."
        ),
    }