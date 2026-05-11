from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import SimpleExpSmoothing


def calculate_metrics(actual: List[float], predicted: List[float]) -> Dict[str, float]:
    if len(actual) != len(predicted) or len(actual) == 0:
        raise ValueError("Actual and predicted series must have the same non-zero length.")

    errors = [(a - p) for a, p in zip(actual, predicted)]
    abs_errors = [abs(e) for e in errors]
    sq_errors = [e * e for e in errors]

    mae = sum(abs_errors) / len(abs_errors)
    mse = sum(sq_errors) / len(sq_errors)
    rmse = mse ** 0.5

    return {
        "mae": round(mae, 6),
        "mse": round(mse, 6),
        "rmse": round(rmse, 6),
    }


def to_float_list(values: List[Any]) -> List[float]:
    return [float(x) for x in values]


def naive_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
) -> Tuple[List[float], List[float]]:
    history = train.tolist()
    test_predictions: List[float] = []

    for actual in test.tolist():
        pred = float(history[-1])
        test_predictions.append(pred)
        history.append(float(actual))

    future_history = pd.concat([train, test]).tolist()
    future_predictions: List[float] = []

    for _ in range(horizon):
        pred = float(future_history[-1])
        future_predictions.append(pred)
        future_history.append(pred)

    return test_predictions, future_predictions


def moving_average_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    window: int,
) -> Tuple[List[float], List[float]]:
    if len(train) < window:
        raise ValueError("Train length is smaller than moving average window.")

    history = train.tolist()
    test_predictions: List[float] = []

    for actual in test.tolist():
        pred = sum(history[-window:]) / window
        test_predictions.append(float(pred))
        history.append(float(actual))

    future_history = pd.concat([train, test]).tolist()
    future_predictions: List[float] = []

    for _ in range(horizon):
        pred = sum(future_history[-window:]) / window
        future_predictions.append(float(pred))
        future_history.append(float(pred))

    return test_predictions, future_predictions


def build_lagged_dataset(values: List[float], lag: int) -> Tuple[List[List[float]], List[float]]:
    if len(values) <= lag:
        raise ValueError("Series is too short for the selected lag.")

    x: List[List[float]] = []
    y: List[float] = []

    for i in range(lag, len(values)):
        x.append(values[i - lag:i])
        y.append(values[i])

    return x, y


def lagged_linear_regression_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    lag: int,
) -> Tuple[List[float], List[float]]:
    train_values = to_float_list(train.tolist())
    x_train, y_train = build_lagged_dataset(train_values, lag)

    model = LinearRegression()
    model.fit(x_train, y_train)

    history = train_values[:]
    test_predictions: List[float] = []

    for actual in to_float_list(test.tolist()):
        features = history[-lag:]
        pred = float(model.predict([features])[0])
        test_predictions.append(pred)
        history.append(actual)

    full_values = to_float_list(pd.concat([train, test]).tolist())
    x_full, y_full = build_lagged_dataset(full_values, lag)

    full_model = LinearRegression()
    full_model.fit(x_full, y_full)

    future_history = full_values[:]
    future_predictions: List[float] = []

    for _ in range(horizon):
        features = future_history[-lag:]
        pred = float(full_model.predict([features])[0])
        future_predictions.append(pred)
        future_history.append(pred)

    return test_predictions, future_predictions


def exponential_smoothing_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    alpha: Optional[float] = None,
) -> Tuple[List[float], List[float]]:
    if alpha is None:
        model = SimpleExpSmoothing(train).fit()
    else:
        model = SimpleExpSmoothing(train).fit(
            smoothing_level=alpha,
            optimized=False,
        )

    test_predictions = model.forecast(len(test)).tolist()

    full_series = pd.concat([train, test]).reset_index(drop=True)

    if alpha is None:
        full_model = SimpleExpSmoothing(full_series).fit()
    else:
        full_model = SimpleExpSmoothing(full_series).fit(
            smoothing_level=alpha,
            optimized=False,
        )

    future_predictions = full_model.forecast(horizon).tolist()

    return to_float_list(test_predictions), to_float_list(future_predictions)


def arima_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    order: Tuple[int, int, int],
) -> Tuple[List[float], List[float]]:
    model = ARIMA(train, order=order).fit()
    test_predictions = model.forecast(steps=len(test)).tolist()

    full_series = pd.concat([train, test]).reset_index(drop=True)
    full_model = ARIMA(full_series, order=order).fit()
    future_predictions = full_model.forecast(steps=horizon).tolist()

    return to_float_list(test_predictions), to_float_list(future_predictions)


def evaluate_candidate(
    model_name: str,
    family: str,
    config: Dict[str, Any],
    test_predictions: List[float],
    future_predictions: List[float],
    test_actual: List[float],
) -> Dict[str, Any]:
    metrics = calculate_metrics(test_actual, test_predictions)

    return {
        "model": model_name,
        "family": family,
        "config": config,
        "metrics": metrics,
        "actual_series": test_actual,
        "predicted_series": test_predictions,
        "future_predictions": future_predictions,
    }


def run_automl_forecast(
    series: pd.Series,
    horizon: int,
    test_size: int,
) -> Dict[str, Any]:
    train = series.iloc[:-test_size].reset_index(drop=True)
    test = series.iloc[-test_size:].reset_index(drop=True)

    if len(train) < 8:
        raise ValueError("Training series is too short for AutoML search.")

    test_actual = to_float_list(test.tolist())
    candidates: List[Dict[str, Any]] = []

    # 1) Naive baseline
    try:
        test_predictions, future_predictions = naive_forecast(train, test, horizon)
        candidates.append(
            evaluate_candidate(
                model_name="Naive (last value)",
                family="Baseline",
                config={},
                test_predictions=test_predictions,
                future_predictions=future_predictions,
                test_actual=test_actual,
            )
        )
    except Exception:
        pass

    # 2) Moving Average with several windows
    max_window = min(8, len(train) - 1)
    for window in range(2, max_window + 1):
        try:
            test_predictions, future_predictions = moving_average_forecast(
                train=train,
                test=test,
                horizon=horizon,
                window=window,
            )
            candidates.append(
                evaluate_candidate(
                    model_name=f"Moving Average | window={window}",
                    family="Moving Average",
                    config={"window": window},
                    test_predictions=test_predictions,
                    future_predictions=future_predictions,
                    test_actual=test_actual,
                )
            )
        except Exception:
            continue

    # 3) Linear Regression with lags
    max_lag = min(8, len(train) - 2)
    for lag in range(2, max_lag + 1):
        try:
            test_predictions, future_predictions = lagged_linear_regression_forecast(
                train=train,
                test=test,
                horizon=horizon,
                lag=lag,
            )
            candidates.append(
                evaluate_candidate(
                    model_name=f"Lagged Linear Regression | lag={lag}",
                    family="Linear Regression",
                    config={"lag": lag},
                    test_predictions=test_predictions,
                    future_predictions=future_predictions,
                    test_actual=test_actual,
                )
            )
        except Exception:
            continue

    # 4) Exponential Smoothing with several alpha values
    for alpha in [None, 0.2, 0.4, 0.6, 0.8]:
        try:
            test_predictions, future_predictions = exponential_smoothing_forecast(
                train=train,
                test=test,
                horizon=horizon,
                alpha=alpha,
            )
            candidates.append(
                evaluate_candidate(
                    model_name=(
                        "Exponential Smoothing | optimized"
                        if alpha is None
                        else f"Exponential Smoothing | alpha={alpha}"
                    ),
                    family="Exponential Smoothing",
                    config={"alpha": alpha},
                    test_predictions=test_predictions,
                    future_predictions=future_predictions,
                    test_actual=test_actual,
                )
            )
        except Exception:
            continue

    # 5) ARIMA with several orders
    arima_orders = [
        (0, 1, 1),
        (1, 1, 0),
        (1, 1, 1),
        (2, 1, 1),
        (2, 1, 2),
    ]

    for order in arima_orders:
        try:
            test_predictions, future_predictions = arima_forecast(
                train=train,
                test=test,
                horizon=horizon,
                order=order,
            )
            candidates.append(
                evaluate_candidate(
                    model_name=f"ARIMA | order={order}",
                    family="ARIMA",
                    config={"order": order},
                    test_predictions=test_predictions,
                    future_predictions=future_predictions,
                    test_actual=test_actual,
                )
            )
        except Exception:
            continue

    if not candidates:
        raise ValueError("AutoML could not produce any valid candidate model.")

    candidates = sorted(
        candidates,
        key=lambda item: (
            item["metrics"]["mae"],
            item["metrics"]["rmse"],
            item["metrics"]["mse"],
        ),
    )

    best = candidates[0]

    ranking = [
        {
            "model": item["model"],
            "family": item["family"],
            "config": item["config"],
            "mae": item["metrics"]["mae"],
            "rmse": item["metrics"]["rmse"],
            "mse": item["metrics"]["mse"],
        }
        for item in candidates
    ]

    return {
        "best_model": best["model"],
        "best_family": best["family"],
        "best_config": best["config"],
        "metrics": best["metrics"],
        "actual_series": best["actual_series"],
        "predicted_series": best["predicted_series"],
        "future_predictions": best["future_predictions"],
        "ranking": ranking,
        "message": "AutoML search completed successfully.",
    }