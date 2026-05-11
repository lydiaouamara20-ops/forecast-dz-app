import base64
import json
import os
from io import BytesIO
from typing import Optional

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st

DEFAULT_BACKEND_URL = os.getenv("FORECAST_BACKEND_URL", "http://127.0.0.1:8000")

MANUAL_MODELS = [
    "Moving Average",
    "Linear Regression",
    "Exponential Smoothing",
    "ARIMA",
]


st.set_page_config(
    page_title="Forecast DZ Analytics",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)


def init_state() -> None:
    defaults = {
        "backend_url": DEFAULT_BACKEND_URL,
        "uploaded_file_name": None,
        "uploaded_file_bytes": None,
        "uploaded_preview_df": None,
        "uploaded_columns": [],
        "result_payload": None,
        "ranking_df": None,
        "last_mode": "automatic",
        "last_model": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


init_state()


def inject_css() -> None:
    st.markdown(
        """
        <style>
        .block-container {
            padding-top: 1.5rem;
            padding-bottom: 2rem;
        }
        .main-title {
            background: linear-gradient(135deg, #0B63E5 0%, #1FA5FF 100%);
            padding: 20px 24px;
            border-radius: 18px;
            color: white;
            margin-bottom: 16px;
            box-shadow: 0 8px 30px rgba(11, 99, 229, 0.18);
        }
        .main-subtitle {
            color: #EAF4FF;
            font-size: 15px;
            margin-top: 6px;
        }
        .soft-card {
            background: #F8FBFF;
            border: 1px solid #DCE6F0;
            border-radius: 16px;
            padding: 18px;
            margin-bottom: 14px;
        }
        .metric-card {
            background: white;
            border: 1px solid #DCE6F0;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 6px 20px rgba(10, 20, 40, 0.04);
        }
        .metric-label {
            color: #64748B;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .metric-value {
            color: #0F172A;
            font-size: 24px;
            font-weight: 700;
        }
        .section-note {
            color: #64748B;
            font-size: 14px;
            margin-top: 4px;
        }
        .success-box {
            background: #ECFDF3;
            border: 1px solid #B7E4C7;
            color: #166534;
            border-radius: 14px;
            padding: 14px;
            font-weight: 600;
        }
        .warn-box {
            background: #FFF7ED;
            border: 1px solid #FED7AA;
            color: #9A3412;
            border-radius: 14px;
            padding: 14px;
            font-weight: 600;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


inject_css()


def render_header() -> None:
    st.markdown(
        """
        <div class="main-title">
            <div style="font-size: 30px; font-weight: 800;">📈 Forecast DZ - Streamlit Analytics Dashboard</div>
            <div class="main-subtitle">
                لوحة تحليل احترافية للتنبؤ، المقارنات، الرسوم البيانية، الترتيب، التصدير، وتجهيز التفسير ودعم القرار.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def metric_card(label: str, value: str) -> None:
    st.markdown(
        f"""
        <div class="metric-card">
            <div class="metric-label">{label}</div>
            <div class="metric-value">{value}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def uploaded_file_to_base64(file_bytes: bytes) -> str:
    return base64.b64encode(file_bytes).decode("utf-8")


def read_preview_dataframe(file_name: str, file_bytes: bytes) -> pd.DataFrame:
    if file_name.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(BytesIO(file_bytes))

    try:
        return pd.read_csv(BytesIO(file_bytes), sep=None, engine="python")
    except Exception:
        return pd.read_csv(BytesIO(file_bytes), sep=";")


def call_backend(endpoint: str, payload: dict) -> dict:
    response = requests.post(
        f"{st.session_state.backend_url}{endpoint}",
        json=payload,
        timeout=180,
    )

    try:
        data = response.json()
    except Exception:
        data = None

    if not response.ok:
        detail = "Backend request failed."
        if isinstance(data, dict) and "detail" in data:
            detail = data["detail"]
        raise Exception(detail)

    return data


def build_actual_vs_predicted_chart(actual_series, predicted_series):
    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=list(range(1, len(actual_series) + 1)),
            y=actual_series,
            mode="lines+markers",
            name="Actual",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=list(range(1, len(predicted_series) + 1)),
            y=predicted_series,
            mode="lines+markers",
            name="Predicted",
        )
    )

    fig.update_layout(
        title="Actual vs Predicted",
        template="plotly_white",
        height=420,
        xaxis_title="Observation Index",
        yaxis_title="Value",
        legend_title="Series",
    )
    return fig


def build_future_forecast_chart(future_predictions):
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=list(range(1, len(future_predictions) + 1)),
            y=future_predictions,
            mode="lines+markers",
            name="Forecast",
        )
    )
    fig.update_layout(
        title="Future Forecast Values",
        template="plotly_white",
        height=380,
        xaxis_title="Forecast Period",
        yaxis_title="Forecast Value",
        legend_title="Series",
    )
    return fig


def build_forecast_values_df(future_predictions):
    return pd.DataFrame(
        {
            "Forecast Period": list(range(1, len(future_predictions) + 1)),
            "Forecast Value": future_predictions,
        }
    )


def build_ranking_df(ranking):
    if not ranking:
        return pd.DataFrame(columns=["rank", "model", "mae", "rmse", "mse"])

    rows = []
    for idx, item in enumerate(ranking, start=1):
        rows.append(
            {
                "rank": idx,
                "model": item.get("model"),
                "mae": item.get("mae"),
                "rmse": item.get("rmse"),
                "mse": item.get("mse"),
            }
        )
    return pd.DataFrame(rows)


def build_explainability_payload(result_payload: dict, mode: str, model: Optional[str]):
    best_model = result_payload.get("best_model") or result_payload.get("selected_model") or model
    return {
        "platforms": {
            "fiddler_ai": {
                "status": "ready_for_future_integration",
                "purpose": "analysis_and_interpretation",
            },
            "datarobot": {
                "status": "ready_for_future_integration",
                "purpose": "decision_guidance",
            },
        },
        "forecast_context": {
            "mode": mode,
            "manual_model": model,
            "best_model": best_model,
        },
        "metrics": result_payload.get("metrics", {}),
        "ranking": result_payload.get("ranking", []),
        "actual_series": result_payload.get("actual_series", []),
        "predicted_series": result_payload.get("predicted_series", []),
        "future_predictions": result_payload.get("future_predictions", []),
        "message": result_payload.get("message"),
    }


def clear_uploaded_data():
    st.session_state.uploaded_file_name = None
    st.session_state.uploaded_file_bytes = None
    st.session_state.uploaded_preview_df = None
    st.session_state.uploaded_columns = []


def clear_results():
    st.session_state.result_payload = None
    st.session_state.ranking_df = None
    st.session_state.last_mode = "automatic"
    st.session_state.last_model = None


render_header()

with st.sidebar:
    st.header("⚙️ الإعدادات")
    st.text_input(
        "Backend URL",
        key="backend_url",
        help="عدّلي هذا الرابط فقط إذا كان الـ backend يعمل على عنوان مختلف.",
    )

    st.markdown("---")
    if st.button("🗑️ مسح النتائج", use_container_width=True):
        clear_results()

    if st.button("🗑️ مسح الملف المرفوع", use_container_width=True):
        clear_uploaded_data()

    st.markdown("---")
    st.caption("النسخة الحالية تدعم التنبؤ أحادي المتغير فقط عبر FastAPI backend.")
    st.caption("النماذج اليدوية الحالية: Moving Average, Linear Regression, Exponential Smoothing, ARIMA")


tab1, tab2, tab3, tab4, tab5 = st.tabs(
    [
        "1. Data Upload",
        "2. Forecast Setup",
        "3. Results",
        "4. Ranking",
        "5. Explainability",
    ]
)

with tab1:
    st.subheader("رفع البيانات")
    st.markdown('<div class="section-note">Upload CSV/XLSX + معاينة البيانات + عرض أسماء الأعمدة</div>', unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Upload CSV/XLSX",
        type=["csv", "xlsx", "xls"],
        key="forecast_data_uploader",
    )

    if uploaded_file is not None:
        file_bytes = uploaded_file.getvalue()
        st.session_state.uploaded_file_name = uploaded_file.name
        st.session_state.uploaded_file_bytes = file_bytes

        try:
            preview_df = read_preview_dataframe(uploaded_file.name, file_bytes)
            st.session_state.uploaded_preview_df = preview_df
            st.session_state.uploaded_columns = [str(col) for col in preview_df.columns]

            st.markdown('<div class="success-box">تم رفع الملف وقراءته بنجاح.</div>', unsafe_allow_html=True)
            st.write(f"**اسم الملف:** {uploaded_file.name}")

            c1, c2 = st.columns([2, 1])
            with c1:
                st.write("### معاينة أول 10 صفوف")
                st.dataframe(preview_df.head(10), use_container_width=True)
            with c2:
                st.write("### أسماء الأعمدة")
                st.write(st.session_state.uploaded_columns)

        except Exception as e:
            st.error(f"تعذر قراءة الملف: {e}")

    else:
        if st.session_state.uploaded_file_name:
            st.info(f"الملف الحالي المحفوظ في الجلسة: {st.session_state.uploaded_file_name}")
        else:
            st.info("ارفعي ملفًا للبدء.")

with tab2:
    st.subheader("إعداد التنبؤ")
    st.markdown('<div class="section-note">Automatic / Manual + الأعمدة + حجم الاختبار + الأفق الزمني + زر التشغيل</div>', unsafe_allow_html=True)

    with st.form("forecast_form"):
        mode = st.radio(
            "اختيار نوع التشغيل",
            options=["automatic", "manual"],
            horizontal=True,
        )

        study_type = st.selectbox(
            "Study type",
            options=["univariate"],
            index=0,
        )

        manual_model = None
        if mode == "manual":
            manual_model = st.selectbox("Select model", MANUAL_MODELS)

        col1, col2 = st.columns(2)
        with col1:
            target_column = st.text_input("Target column", value="PRIX")
            test_size = st.number_input("Test size", min_value=1, value=6, step=1)
        with col2:
            date_column = st.text_input("Date column (optional)", value="DATE")
            forecast_horizon = st.number_input("Forecast horizon", min_value=1, value=6, step=1)

        run_forecast = st.form_submit_button("🚀 تشغيل التنبؤ", use_container_width=True)

    if run_forecast:
        if st.session_state.uploaded_file_bytes is None or st.session_state.uploaded_file_name is None:
            st.error("يرجى رفع ملف أولًا من تبويب Data Upload.")
        elif not target_column.strip():
            st.error("يرجى إدخال Target column.")
        else:
            try:
                payload = {
                    "study_type": study_type,
                    "mode": mode,
                    "horizon": int(forecast_horizon),
                    "test_size": int(test_size),
                    "file_name": st.session_state.uploaded_file_name,
                    "file_base64": uploaded_file_to_base64(st.session_state.uploaded_file_bytes),
                    "target_column": target_column.strip(),
                    "date_column": date_column.strip() if date_column.strip() else None,
                }

                endpoint = "/forecast/automatic"
                if mode == "manual":
                    payload["model"] = manual_model
                    endpoint = "/forecast/manual"

                with st.spinner("جاري تنفيذ التنبؤ..."):
                    result = call_backend(endpoint, payload)

                st.session_state.result_payload = result
                st.session_state.ranking_df = build_ranking_df(result.get("ranking", []))
                st.session_state.last_mode = mode
                st.session_state.last_model = manual_model

                st.markdown('<div class="success-box">تم تنفيذ التنبؤ بنجاح. انتقلي إلى تبويب Results.</div>', unsafe_allow_html=True)

            except Exception as e:
                st.error(f"فشل التنبؤ: {e}")

with tab3:
    st.subheader("النتائج")
    st.markdown('<div class="section-note">Best Model + MAE/RMSE/MSE + Forecast values + Actual vs Predicted chart</div>', unsafe_allow_html=True)

    result = st.session_state.result_payload

    if not result:
        st.info("لا توجد نتائج بعد. شغّلي التنبؤ من تبويب Forecast Setup.")
    else:
        best_model = result.get("best_model") or result.get("selected_model") or "-"
        metrics = result.get("metrics", {})
        actual_series = result.get("actual_series", [])
        predicted_series = result.get("predicted_series", [])
        future_predictions = result.get("future_predictions", [])

        c1, c2, c3, c4 = st.columns(4)
        with c1:
            metric_card("Best Model", str(best_model))
        with c2:
            metric_card("MAE", str(metrics.get("mae", "--")))
        with c3:
            metric_card("RMSE", str(metrics.get("rmse", "--")))
        with c4:
            metric_card("MSE", str(metrics.get("mse", "--")))

        st.markdown("### Forecast values")
        forecast_df = build_forecast_values_df(future_predictions)
        st.dataframe(forecast_df, use_container_width=True)

        d1, d2 = st.columns(2)

        with d1:
            st.markdown("### Actual vs Predicted")
            if actual_series and predicted_series:
                fig_actual = build_actual_vs_predicted_chart(actual_series, predicted_series)
                st.plotly_chart(fig_actual, use_container_width=True)
            else:
                st.warning("لا توجد بيانات كافية للرسم البياني الفعلي والمتنبأ به.")

        with d2:
            st.markdown("### Future Forecast")
            if future_predictions:
                fig_future = build_future_forecast_chart(future_predictions)
                st.plotly_chart(fig_future, use_container_width=True)
            else:
                st.warning("لا توجد قيم مستقبلية متنبأ بها.")

        st.markdown("### Payload result")
        st.json(result)

with tab4:
    st.subheader("ترتيب النماذج")
    st.markdown('<div class="section-note">Ranking table + export CSV/JSON</div>', unsafe_allow_html=True)

    ranking_df = st.session_state.ranking_df

    if ranking_df is None or ranking_df.empty:
        st.info("لا يوجد ترتيب نماذج بعد. شغّلي التنبؤ أولًا.")
    else:
        st.dataframe(ranking_df, use_container_width=True)

        csv_bytes = ranking_df.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="⬇️ تصدير ترتيب النماذج CSV",
            data=csv_bytes,
            file_name="ranking_results.csv",
            mime="text/csv",
            use_container_width=True,
        )

        json_bytes = json.dumps(
            st.session_state.result_payload,
            ensure_ascii=False,
            indent=2,
        ).encode("utf-8")

        st.download_button(
            label="⬇️ تصدير النتائج JSON",
            data=json_bytes,
            file_name="forecast_results.json",
            mime="application/json",
            use_container_width=True,
        )

with tab5:
    st.subheader("Explainability / Decision Support")
    st.markdown('<div class="section-note">Fiddler AI + DataRobot + reports + interpretation</div>', unsafe_allow_html=True)

    result = st.session_state.result_payload

    if not result:
        st.info("نفّذي التنبؤ أولًا حتى يتم تجهيز explainability payload.")
    else:
        explain_payload = build_explainability_payload(
            result_payload=result,
            mode=st.session_state.last_mode,
            model=st.session_state.last_model,
        )

        e1, e2 = st.columns(2)

        with e1:
            st.markdown("### Fiddler AI")
            st.markdown(
                '<div class="soft-card">هذا القسم مهيأ لربط لاحق مع Fiddler AI لتحليل النتائج وتفسير السلوك والأداء.</div>',
                unsafe_allow_html=True,
            )

        with e2:
            st.markdown("### DataRobot")
            st.markdown(
                '<div class="soft-card">هذا القسم مهيأ لربط لاحق مع DataRobot لتوجيه القرار، مقارنة الأداء، وتوليد توصيات عملية.</div>',
                unsafe_allow_html=True,
            )

        st.markdown("### Explainability payload")
        st.json(explain_payload)

        explain_bytes = json.dumps(
            explain_payload,
            ensure_ascii=False,
            indent=2,
        ).encode("utf-8")

        st.download_button(
            label="⬇️ تصدير Explainability JSON",
            data=explain_bytes,
            file_name="explainability_payload.json",
            mime="application/json",
            use_container_width=True,
        )

        st.markdown("### تقارير وتفسير")
        st.markdown(
            """
            - تفسير المقاييس MAE / RMSE / MSE  
            - عرض أفضل نموذج  
            - تجهيز مخرجات للإرسال إلى Fiddler AI  
            - تجهيز مخرجات للإرسال إلى DataRobot  
            - دعم لاحق لتقارير PDF ومتابعة الأداء
            """
        )