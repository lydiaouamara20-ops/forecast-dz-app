import base64
import io
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from app.services.automl import run_automl_forecast
from app.services.recommendation import build_manual_recommendation 
from app.services.integration_payloads import build_fiddler_payload, build_datarobot_payload
from app.services.database import (
    delete_forecast_record,
    get_forecast_record,
    init_db,
    list_forecast_records,
    save_forecast_record,
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import SimpleExpSmoothing

app = FastAPI(title="Forecast DZ Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def startup_event():
    init_db()

class AutomaticForecastRequest(BaseModel):
    study_type: str = Field(default="univariate")
    mode: str = Field(default="automatic")
    horizon: int
    test_size: int = 6
    file_name: str
    file_base64: str
    target_column: str
    date_column: Optional[str] = None


class ManualForecastRequest(BaseModel):
    study_type: str = Field(default="univariate")
    mode: str = Field(default="manual")
    model: str
    horizon: int
    test_size: int = 6
    file_name: str
    file_base64: str
    target_column: str
    date_column: Optional[str] = None


class ManualRecommendationRequest(BaseModel):
    study_type: str = Field(default="univariate")
    file_name: str
    file_base64: str
    target_column: str
    date_column: Optional[str] = None

class IntegrationPayloadRequest(BaseModel):
    platform: str
    result: Dict[str, Any]
    sector: Optional[str] = None
    study_type: str = "univariate"
    mode: str = "automatic"

class SaveForecastRecordRequest(BaseModel):
    forecast: Dict[str, Any]
    integration: Optional[Dict[str, Any]] = None
    report: Optional[Dict[str, Any]] = None 

def normalize_column_name(name: str) -> str:
    return str(name).replace("\ufeff", "").strip().lower()


def resolve_column_name(df: pd.DataFrame, requested_name: str) -> Optional[str]:
    wanted = normalize_column_name(requested_name)
    for col in df.columns:
        if normalize_column_name(col) == wanted:
            return col
    return None


def load_dataframe_from_base64(file_name: str, file_base64: str) -> pd.DataFrame:
    try:
        raw = base64.b64decode(file_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 file content.") from exc

    file_name_lower = file_name.lower()

    try:
        if file_name_lower.endswith(".xlsx") or file_name_lower.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(raw))
        else:
            try:
                df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python")
            except Exception:
                df = pd.read_csv(io.BytesIO(raw), sep=";")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to read CSV/Excel file.") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    df.columns = [str(col).replace("\ufeff", "").strip() for col in df.columns]
    return df


def prepare_series(df: pd.DataFrame, target_column: str, date_column: Optional[str]) -> pd.Series:
    real_target_column = resolve_column_name(df, target_column)
    if real_target_column is None:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{target_column}' not found in the file."
        )

    working_df = df.copy()

    if date_column:
        real_date_column = resolve_column_name(working_df, date_column)
        if real_date_column is None:
            raise HTTPException(
                status_code=400,
                detail=f"Date column '{date_column}' not found in the file."
            )

        working_df[real_date_column] = pd.to_datetime(
            working_df[real_date_column],
            errors="coerce",
            dayfirst=True
        )
        working_df = working_df.sort_values(by=real_date_column)

    series = pd.to_numeric(
        working_df[real_target_column],
        errors="coerce"
    ).dropna().reset_index(drop=True)

    if len(series) < 10:
        raise HTTPException(
            status_code=400,
            detail="Not enough usable numeric data in the target column. Minimum required: 10 values."
        )

    return series


def normalize_test_size(series_len: int, requested_test_size: int) -> int:
    requested = max(1, int(requested_test_size))
    test_size = min(requested, series_len - 5)

    if test_size < 1:
        raise HTTPException(
            status_code=400,
            detail="Dataset is too short to split into training and test sets."
        )

    return test_size


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


def moving_average_forecast(train: pd.Series, test: pd.Series, horizon: int) -> Tuple[List[float], List[float]]:
    window = max(2, min(5, len(train)))
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


def linear_regression_forecast(train: pd.Series, test: pd.Series, horizon: int) -> Tuple[List[float], List[float]]:
    x_train = [[i] for i in range(len(train))]
    y_train = train.tolist()

    model = LinearRegression()
    model.fit(x_train, y_train)

    x_test = [[i] for i in range(len(train), len(train) + len(test))]
    test_predictions = model.predict(x_test).tolist()

    x_future = [[i] for i in range(len(train) + len(test), len(train) + len(test) + horizon)]
    future_predictions = model.predict(x_future).tolist()

    return [float(x) for x in test_predictions], [float(x) for x in future_predictions]


def exponential_smoothing_forecast(train: pd.Series, test: pd.Series, horizon: int) -> Tuple[List[float], List[float]]:
    model = SimpleExpSmoothing(train).fit()
    test_predictions = model.forecast(len(test)).tolist()

    full_series = pd.concat([train, test]).reset_index(drop=True)
    full_model = SimpleExpSmoothing(full_series).fit()
    future_predictions = full_model.forecast(horizon).tolist()

    return [float(x) for x in test_predictions], [float(x) for x in future_predictions]


def arima_forecast(train: pd.Series, test: pd.Series, horizon: int, order=(1, 1, 1)) -> Tuple[List[float], List[float]]:
    model = ARIMA(train, order=order).fit()
    test_predictions = model.forecast(steps=len(test)).tolist()

    full_series = pd.concat([train, test]).reset_index(drop=True)
    full_model = ARIMA(full_series, order=order).fit()
    future_predictions = full_model.forecast(steps=horizon).tolist()

    return [float(x) for x in test_predictions], [float(x) for x in future_predictions]


SUPPORTED_AUTOMATIC_MODELS = {
    "Moving Average": moving_average_forecast,
    "Linear Regression": linear_regression_forecast,
    "Exponential Smoothing": exponential_smoothing_forecast,
    "ARIMA": arima_forecast,
}

SUPPORTED_MANUAL_MODELS = {
    "Moving Average": moving_average_forecast,
    "Linear Regression": linear_regression_forecast,
    "Exponential Smoothing": exponential_smoothing_forecast,
    "ARIMA": arima_forecast,
}


def run_model(
    model_name: str,
    runner,
    series: pd.Series,
    horizon: int,
    test_size: int,
) -> Dict[str, Any]:
    train = series.iloc[:-test_size].reset_index(drop=True)
    test = series.iloc[-test_size:].reset_index(drop=True)

    if len(train) < 5:
        raise ValueError("Training series is too short.")

    predicted_test, future_predictions = runner(train, test, horizon)
    metrics = calculate_metrics(test.tolist(), predicted_test)

    return {
        "model": model_name,
        "metrics": metrics,
        "actual_series": [float(x) for x in test.tolist()],
        "predicted_series": [float(x) for x in predicted_test],
        "future_predictions": [float(x) for x in future_predictions],
    }


@app.get("/")
def root():
    return {"message": "Forecast DZ backend is running."}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/integrations/prepare")
def prepare_integration_payload(request: IntegrationPayloadRequest):
    platform = request.platform.lower().strip()

    if platform in ["fiddler", "fiddler_ai", "fiddler ai"]:
        return build_fiddler_payload(
            result=request.result,
            sector=request.sector,
            study_type=request.study_type,
            mode=request.mode,
        )

    if platform in ["datarobot", "data_robot", "data robot"]:
        return build_datarobot_payload(
            result=request.result,
            sector=request.sector,
            study_type=request.study_type,
            mode=request.mode,
        )

    raise HTTPException(
        status_code=400,
        detail="Unsupported platform. Use 'fiddler' or 'datarobot'."
    )
@app.post("/forecasts/save")
def save_forecast(request: SaveForecastRecordRequest):
    try:
        return save_forecast_record(
            forecast=request.forecast,
            integration=request.integration,
            report=request.report,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save forecast record: {str(exc)}",
        ) from exc


@app.get("/forecasts")
def list_forecasts():
    try:
        return {
            "items": list_forecast_records()
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to list forecast records: {str(exc)}",
        ) from exc


@app.get("/forecasts/{forecast_id}")
def get_forecast(forecast_id: str):
    try:
        return get_forecast_record(forecast_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to get forecast record: {str(exc)}",
        ) from exc


@app.delete("/forecasts/{forecast_id}")
def delete_forecast(forecast_id: str):
    try:
        return delete_forecast_record(forecast_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete forecast record: {str(exc)}",
        ) from exc
@app.post("/forecasts/save")
def save_forecast(request: SaveForecastRecordRequest):
    try:
        return save_forecast_record(
            forecast=request.forecast,
            integration=request.integration,
            report=request.report,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save forecast record: {str(exc)}",
        ) from exc


@app.get("/forecasts")
def list_forecasts():
    try:
        return {
            "items": list_forecast_records()
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to list forecast records: {str(exc)}",
        ) from exc


@app.get("/forecasts/{forecast_id}")
def get_forecast(forecast_id: str):
    try:
        return get_forecast_record(forecast_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to get forecast record: {str(exc)}",
        ) from exc


@app.delete("/forecasts/{forecast_id}")
def delete_forecast(forecast_id: str):
    try:
        return delete_forecast_record(forecast_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete forecast record: {str(exc)}",
        ) from exc 
@app.post("/forecast/automatic")
def automatic_forecast(request: AutomaticForecastRequest):
    if request.study_type != "univariate":
        raise HTTPException(
            status_code=400,
            detail="Current backend phase supports univariate forecasting only."
        )

    df = load_dataframe_from_base64(request.file_name, request.file_base64)
    series = prepare_series(df, request.target_column, request.date_column)
    test_size = normalize_test_size(len(series), request.test_size)

    try:
        result = run_automl_forecast(
            series=series,
            horizon=request.horizon,
            test_size=test_size,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AutoML automatic forecasting failed: {str(exc)}"
        ) from exc

    return result


@app.post("/recommend/manual")
def recommend_manual_models(request: ManualRecommendationRequest):
    df = load_dataframe_from_base64(request.file_name, request.file_base64)
    series = prepare_series(df, request.target_column, request.date_column)

    try:
        result = build_manual_recommendation(
            df=df,
            series=series,
            study_type=request.study_type,
            target_column=request.target_column,
            date_column=request.date_column,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Manual recommendation failed: {str(exc)}"
        ) from exc

    return result


@app.post("/forecast/manual")
def manual_forecast(request: ManualForecastRequest):
    if request.study_type != "univariate":
        raise HTTPException(
            status_code=400,
            detail="Current backend phase supports univariate forecasting only."
        )

    if request.model not in SUPPORTED_MANUAL_MODELS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Model '{request.model}' is not yet implemented in backend phase 1. "
                f"Supported models: {', '.join(SUPPORTED_MANUAL_MODELS.keys())}"
            ),
        )

    df = load_dataframe_from_base64(request.file_name, request.file_base64)
    series = prepare_series(df, request.target_column, request.date_column)
    test_size = normalize_test_size(len(series), request.test_size)

    runner = SUPPORTED_MANUAL_MODELS[request.model]

    try:
        result = run_model(
            model_name=request.model,
            runner=runner,
            series=series,
            horizon=request.horizon,
            test_size=test_size,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Manual forecasting failed for model '{request.model}'."
        ) from exc

    return {
        "selected_model": result["model"],
        "metrics": result["metrics"],
        "actual_series": result["actual_series"],
        "predicted_series": result["predicted_series"],
        "future_predictions": result["future_predictions"],
        "ranking": [
            {
                "model": result["model"],
                "mae": result["metrics"]["mae"],
                "rmse": result["metrics"]["rmse"],
                "mse": result["metrics"]["mse"],
            }
        ],
        "message": "Manual forecasting completed successfully.",
    }