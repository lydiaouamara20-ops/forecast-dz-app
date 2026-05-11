import base64
import io
from typing import Optional, Tuple

import numpy as np
import pandas as pd


def decode_file_to_dataframe(file_base64: str, file_name: str) -> pd.DataFrame:
    raw = base64.b64decode(file_base64)
    buffer = io.BytesIO(raw)

    lower_name = file_name.lower()

    if lower_name.endswith(".csv"):
        return pd.read_csv(buffer)

    if lower_name.endswith(".xlsx") or lower_name.endswith(".xls"):
        return pd.read_excel(buffer)

    raise ValueError("Unsupported file format. Use CSV or Excel.")


def prepare_univariate_series(
    df: pd.DataFrame,
    target_column: str,
    date_column: Optional[str] = None
) -> pd.Series:
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    data = df.copy()

    if date_column:
        if date_column not in data.columns:
            raise ValueError(f"Date column '{date_column}' not found in dataset.")
        data[date_column] = pd.to_datetime(data[date_column], errors="coerce")
        data = data.dropna(subset=[date_column])
        data = data.sort_values(by=date_column)

    data[target_column] = pd.to_numeric(data[target_column], errors="coerce")
    data = data.dropna(subset=[target_column])

    series = data[target_column].reset_index(drop=True)

    if len(series) < 8:
        raise ValueError("Dataset is too small. At least 8 valid observations are required.")

    return series


def train_test_split_series(series: pd.Series, test_size: int) -> Tuple[pd.Series, pd.Series]:
    if test_size <= 0:
        raise ValueError("test_size must be greater than 0.")

    if len(series) <= test_size + 2:
        raise ValueError("Not enough data for train/test split.")

    train = series.iloc[:-test_size].reset_index(drop=True)
    test = series.iloc[-test_size:].reset_index(drop=True)
    return train, test


def future_index(length: int):
    return list(range(1, length + 1))


def series_to_list(series):
    if isinstance(series, pd.Series):
        return [float(x) for x in series.tolist()]
    if isinstance(series, np.ndarray):
        return [float(x) for x in series.tolist()]
    return [float(x) for x in series]