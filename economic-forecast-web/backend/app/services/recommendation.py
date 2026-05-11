from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def _r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if ss_tot == 0:
        return 0.0
    return 1.0 - (ss_res / ss_tot)


def _safe_autocorr(values: List[float], lag: int) -> float:
    if len(values) <= lag + 2:
        return 0.0
    try:
        result = pd.Series(values).autocorr(lag=lag)
        if pd.isna(result):
            return 0.0
        return float(result)
    except Exception:
        return 0.0


def _length_bucket(n: int) -> str:
    if n < 60:
        return "short"
    if n < 180:
        return "medium"
    return "long"


def _detect_trend(values: np.ndarray) -> Dict[str, Any]:
    n = len(values)
    x = np.arange(n).reshape(-1, 1)

    model = LinearRegression()
    model.fit(x, values)

    slope = float(model.coef_[0])
    linear_pred = model.predict(x)
    linear_r2 = _r2_score(values, linear_pred)

    span_ratio = float((values[-1] - values[0]) / (abs(values[0]) + 1e-9))
    detected = abs(span_ratio) >= 0.08 or abs(slope) >= 0.02 * (float(np.std(values)) + 1e-9)

    return {
        "detected": detected,
        "slope": slope,
        "span_ratio": span_ratio,
        "linear_r2": linear_r2,
        "details": (
            f"Trend detected with slope={slope:.4f}, "
            f"span change={span_ratio:.2%}, linear fit R²={linear_r2:.3f}"
            if detected
            else f"No strong trend detected. Linear fit R²={linear_r2:.3f}"
        ),
    }


def _detect_seasonality(values: np.ndarray) -> Dict[str, Any]:
    candidates = [4, 6, 7, 12]
    valid_scores = []

    for lag in candidates:
        if len(values) >= (lag * 2 + 2):
            acf = _safe_autocorr(values.tolist(), lag)
            valid_scores.append((lag, acf))

    if not valid_scores:
        return {
            "detected": False,
            "lag": None,
            "score": 0.0,
            "details": "Not enough data to test seasonality reliably.",
        }

    best_lag, best_score = max(valid_scores, key=lambda item: abs(item[1]))
    detected = abs(best_score) >= 0.45

    return {
        "detected": detected,
        "lag": best_lag,
        "score": float(best_score),
        "details": (
            f"Seasonality detected around lag={best_lag} with autocorrelation={best_score:.3f}"
            if detected
            else f"No strong seasonality detected. Best tested lag={best_lag}, autocorrelation={best_score:.3f}"
        ),
    }


def _detect_volatility(values: np.ndarray) -> Dict[str, Any]:
    s = pd.Series(values)
    pct = s.pct_change().replace([np.inf, -np.inf], np.nan).dropna()

    pct_std = float(pct.std()) if len(pct) else 0.0
    abs_diff_std = float(s.diff().dropna().std()) if len(s) > 1 else 0.0
    series_std = float(s.std()) if len(s) > 1 else 0.0

    detected = pct_std >= 0.08 or (
        series_std > 0 and abs_diff_std >= 0.25 * series_std
    )

    return {
        "detected": detected,
        "pct_std": pct_std,
        "details": (
            f"Volatility detected: return std={pct_std:.4f}"
            if detected
            else f"No strong volatility detected: return std={pct_std:.4f}"
        ),
    }


def _detect_nonlinearity(values: np.ndarray) -> Dict[str, Any]:
    n = len(values)
    x = np.arange(n, dtype=float)

    linear_coef = np.polyfit(x, values, 1)
    linear_pred = np.polyval(linear_coef, x)
    linear_r2 = _r2_score(values, linear_pred)

    poly2_coef = np.polyfit(x, values, 2)
    poly2_pred = np.polyval(poly2_coef, x)
    poly2_r2 = _r2_score(values, poly2_pred)

    improvement = float(poly2_r2 - linear_r2)
    detected = improvement >= 0.12

    return {
        "detected": detected,
        "linear_r2": linear_r2,
        "poly2_r2": poly2_r2,
        "improvement": improvement,
        "details": (
            f"Possible non-linearity detected: polynomial fit improves R² by {improvement:.3f}"
            if detected
            else f"No strong non-linearity detected: polynomial improvement={improvement:.3f}"
        ),
    }


def _push_recommendation(
    items: List[Dict[str, str]],
    model: str,
    reason: str,
) -> None:
    exists = any(entry["model"] == model for entry in items)
    if not exists:
        items.append({"model": model, "reason": reason})


def build_manual_recommendation(
    df: pd.DataFrame,
    series: pd.Series,
    study_type: str,
    target_column: str,
    date_column: Optional[str],
) -> Dict[str, Any]:
    values = np.asarray(series.astype(float).tolist(), dtype=float)
    n = len(values)
    length_bucket = _length_bucket(n)

    excluded = {target_column}
    if date_column:
        excluded.add(date_column)

    numeric_exogenous = [
        col
        for col in df.columns
        if col not in excluded and pd.api.types.is_numeric_dtype(df[col])
    ]

    is_multivariate = study_type == "multivariate"

    trend = _detect_trend(values)
    seasonality = _detect_seasonality(values)
    volatility = _detect_volatility(values)
    nonlinearity = _detect_nonlinearity(values)

    detected_patterns = [
        {
            "name": "Study type",
            "detected": True,
            "details": (
                f"Multivariate study with {len(numeric_exogenous)} additional numeric variables"
                if is_multivariate
                else "Univariate study focused on one target series"
            ),
        },
        {
            "name": "Dataset length",
            "detected": True,
            "details": f"{n} observations detected => {length_bucket} dataset",
        },
        {
            "name": "Trend",
            "detected": trend["detected"],
            "details": trend["details"],
        },
        {
            "name": "Seasonality",
            "detected": seasonality["detected"],
            "details": seasonality["details"],
        },
        {
            "name": "Volatility",
            "detected": volatility["detected"],
            "details": volatility["details"],
        },
        {
            "name": "Non-linearity",
            "detected": nonlinearity["detected"],
            "details": nonlinearity["details"],
        },
    ]

    recommended_models: List[Dict[str, str]] = []

    if not is_multivariate:
        if seasonality["detected"]:
            _push_recommendation(
                recommended_models,
                "SARIMA",
                "Recommended because seasonality was detected in the series.",
            )
            _push_recommendation(
                recommended_models,
                "Holt-Winters",
                "Recommended because the data appears to contain seasonality and possibly trend.",
            )
            _push_recommendation(
                recommended_models,
                "ETS",
                "Recommended because ETS handles error, trend, and seasonality in a structured way.",
            )

        if trend["detected"] and not seasonality["detected"]:
            _push_recommendation(
                recommended_models,
                "Holt",
                "Recommended because the data shows trend without strong seasonality.",
            )
            _push_recommendation(
                recommended_models,
                "ARIMA",
                "Recommended because ARIMA often performs well on trending univariate series.",
            )
            _push_recommendation(
                recommended_models,
                "ETS",
                "Recommended because ETS is a strong classical option for trend-dominated series.",
            )

        if volatility["detected"]:
            _push_recommendation(
                recommended_models,
                "GARCH",
                "Recommended because the series appears volatile and variance may change over time.",
            )
            _push_recommendation(
                recommended_models,
                "ARIMA + GARCH",
                "Recommended because mean behavior and volatility may both matter.",
            )
            if seasonality["detected"]:
                _push_recommendation(
                    recommended_models,
                    "SARIMA + GARCH",
                    "Recommended because the series appears both seasonal and volatile.",
                )

        if nonlinearity["detected"]:
            _push_recommendation(
                recommended_models,
                "LightGBM",
                "Recommended because the series shows signs of non-linearity.",
            )
            _push_recommendation(
                recommended_models,
                "XGBoost",
                "Recommended because boosted trees can capture non-linear time-based patterns.",
            )
            _push_recommendation(
                recommended_models,
                "Support Vector Regression (SVR)",
                "Recommended because SVR often works well on non-linear medium-size datasets.",
            )

            if length_bucket == "long":
                _push_recommendation(
                    recommended_models,
                    "LSTM",
                    "Recommended because the dataset is long enough and may benefit from sequence modeling.",
                )
                _push_recommendation(
                    recommended_models,
                    "GRU",
                    "Recommended because the dataset is long enough and may benefit from sequence modeling.",
                )

        if nonlinearity["detected"] and volatility["detected"]:
            _push_recommendation(
                recommended_models,
                "ANFIS (Neuro-Fuzzy)",
                "Recommended because fuzzy-neural hybrids can help when the series is non-linear and uncertain.",
            )
            _push_recommendation(
                recommended_models,
                "Fuzzy Logic + LSTM",
                "Recommended because uncertainty and non-linearity were both detected.",
            )

        if length_bucket == "short":
            _push_recommendation(
                recommended_models,
                "Exponential Smoothing",
                "Recommended because short datasets usually benefit from simpler and more stable models.",
            )
            _push_recommendation(
                recommended_models,
                "Moving Average",
                "Recommended as a stable baseline for short or noisy series.",
            )

    else:
        _push_recommendation(
            recommended_models,
            "VAR",
            "Recommended because multivariate relationships between variables may matter.",
        )
        _push_recommendation(
            recommended_models,
            "VECM",
            "Recommended for multivariate systems when long-run relationships may exist.",
        )
        _push_recommendation(
            recommended_models,
            "VARMAX",
            "Recommended because it extends multivariate forecasting with a richer structure.",
        )

        if volatility["detected"]:
            _push_recommendation(
                recommended_models,
                "VAR + GARCH",
                "Recommended because the multivariate system appears volatile.",
            )

        if nonlinearity["detected"]:
            _push_recommendation(
                recommended_models,
                "LightGBM",
                "Recommended because multivariate data may contain non-linear relationships.",
            )
            _push_recommendation(
                recommended_models,
                "XGBoost",
                "Recommended because boosted trees can capture complex relationships across variables.",
            )

        if length_bucket == "long":
            _push_recommendation(
                recommended_models,
                "Transformers for Time Series Forecasting",
                "Recommended because long multivariate sequences may benefit from transformer-based modeling.",
            )
            _push_recommendation(
                recommended_models,
                "LSTM",
                "Recommended because longer multivariate sequences may benefit from sequence modeling.",
            )

        if nonlinearity["detected"] and volatility["detected"]:
            _push_recommendation(
                recommended_models,
                "ANFIS (Neuro-Fuzzy)",
                "Recommended because fuzzy-neural hybrids can help in uncertain multivariate settings.",
            )
            _push_recommendation(
                recommended_models,
                "Fuzzy Logic + GRU",
                "Recommended because the data appears both uncertain and non-linear.",
            )

    summary = (
        f"Detected a {length_bucket} "
        f"{'multivariate' if is_multivariate else 'univariate'} dataset "
        f"with trend={trend['detected']}, "
        f"seasonality={seasonality['detected']}, "
        f"volatility={volatility['detected']}, "
        f"nonlinearity={nonlinearity['detected']}."
    )

    return {
        "summary": summary,
        "detected_patterns": detected_patterns,
        "recommended_models": recommended_models[:6],
    }