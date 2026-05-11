from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.services.metrics import all_metrics
from app.services.preprocessing import series_to_list


def moving_average_walk_forward(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    window: int = 3
) -> Dict:
    history = train.tolist()
    preds_test: List[float] = []

    for actual in test.tolist():
        current_window = history[-window:] if len(history) >= window else history
        pred = float(np.mean(current_window))
        preds_test.append(pred)
        history.append(float(actual))

    future_preds: List[float] = []
    future_history = history.copy()

    for _ in range(horizon):
        current_window = (
            future_history[-window:] if len(future_history) >= window else future_history
        )
        pred = float(np.mean(current_window))
        future_preds.append(pred)
        future_history.append(pred)

    metrics = all_metrics(test, preds_test)

    return {
        "model": "Moving Average",
        "metrics": metrics,
        "actual_series": series_to_list(test),
        "predicted_series": preds_test,
        "future_predictions": future_preds,
    }


def exponential_smoothing_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int
) -> Dict:
    model = ExponentialSmoothing(
        train,
        trend="add",
        seasonal=None,
        initialization_method="estimated",
    )
    fitted = model.fit(optimized=True)
    total_steps = len(test) + horizon
    forecast = fitted.forecast(total_steps)

    preds_test = series_to_list(forecast[: len(test)])
    future_preds = series_to_list(forecast[len(test):])

    metrics = all_metrics(test, preds_test)

    return {
        "model": "Exponential Smoothing",
        "metrics": metrics,
        "actual_series": series_to_list(test),
        "predicted_series": preds_test,
        "future_predictions": future_preds,
    }


def linear_regression_time_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int
) -> Dict:
    full_len = len(train) + len(test) + horizon

    x_train = np.arange(len(train)).reshape(-1, 1)
    y_train = train.values.astype(float)

    reg = LinearRegression()
    reg.fit(x_train, y_train)

    x_test = np.arange(len(train), len(train) + len(test)).reshape(-1, 1)
    preds_test = reg.predict(x_test)

    x_future = np.arange(len(train) + len(test), full_len).reshape(-1, 1)
    future_preds = reg.predict(x_future)

    preds_test_list = [float(x) for x in preds_test.tolist()]
    future_preds_list = [float(x) for x in future_preds.tolist()]

    metrics = all_metrics(test, preds_test_list)

    return {
        "model": "Linear Regression",
        "metrics": metrics,
        "actual_series": series_to_list(test),
        "predicted_series": preds_test_list,
        "future_predictions": future_preds_list,
    }


def arima_forecast(
    train: pd.Series,
    test: pd.Series,
    horizon: int,
    order=(1, 1, 1)
) -> Dict:
    model = ARIMA(train, order=order)
    fitted = model.fit()

    total_steps = len(test) + horizon
    forecast = fitted.forecast(steps=total_steps)

    preds_test = series_to_list(forecast[: len(test)])
    future_preds = series_to_list(forecast[len(test):])

    metrics = all_metrics(test, preds_test)

    return {
        "model": "ARIMA",
        "metrics": metrics,
        "actual_series": series_to_list(test),
        "predicted_series": preds_test,
        "future_predictions": future_preds,
    }


def run_all_classical_models(
    train: pd.Series,
    test: pd.Series,
    horizon: int
) -> List[Dict]:
    results = []

    model_functions = [
        ("Moving Average", lambda: moving_average_walk_forward(train, test, horizon)),
        ("Exponential Smoothing", lambda: exponential_smoothing_forecast(train, test, horizon)),
        ("Linear Regression", lambda: linear_regression_time_forecast(train, test, horizon)),
        ("ARIMA", lambda: arima_forecast(train, test, horizon)),
    ]

    for model_name, fn in model_functions:
        try:
            results.append(fn())
        except Exception as exc:
            results.append(
                {
                    "model": model_name,
                    "metrics": {"mae": None, "rmse": None, "mse": None},
                    "actual_series": series_to_list(test),
                    "predicted_series": [],
                    "future_predictions": [],
                    "error": str(exc),
                }
            )

    return results