from __future__ import annotations

import math
import tempfile
from io import BytesIO
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st
from matplotlib.patches import Ellipse

from pysurveying import __version__
from pysurveying.adjustment import (
    adjust_control_network,
    adjust_control_network_robust,
    adjust_free_network,
    least_squares,
)
from pysurveying.basic import (
    azimuth,
    distance,
    distance_intersection,
    forward_coordinate,
    forward_intersection,
    resection,
)
from pysurveying.engineering import (
    chainage_offset,
    grade_elevation,
    polar_stakeout,
    polygon_area,
    slope,
)
from pysurveying.io import adjustment_tables, read_points
from pysurveying.leveling import leveling_network, leveling_route
from pysurveying.models import LevelObservation, Observation, Point
from pysurveying.precision import control_network_precision
from pysurveying.quality import (
    control_network_data_snooping,
    control_network_quality,
    data_snooping,
    error_ellipse,
    robust_least_squares,
)
from pysurveying.transform import (
    fit_affine_2d,
    fit_similarity_2d,
    geodetic_to_enu,
    transform_coordinates,
)
from pysurveying.traverse import closed_traverse, closed_traverse_from_angles, connected_traverse


st.set_page_config(page_title=f"pySurveying {__version__}", page_icon="📐", layout="wide")
st.title(f"pySurveying {__version__}")
st.caption("轻量级测量计算、测量平差、质量控制与可视化工具包")

st.sidebar.markdown(f"**pySurveying {__version__}**")
st.sidebar.caption("平面约定：+Y 为北、+X 为东；方位角从北顺时针。")
page = st.sidebar.radio(
    "功能",
    [
        "首页",
        "基础计算",
        "交会与后方交会",
        "导线",
        "水准",
        "控制网",
        "平差与质量",
        "坐标转换",
        "工程测量",
        "数据与示例",
    ],
)
st.sidebar.divider()
st.sidebar.caption("当前版本冻结工程测量扩展和新增仪器格式，重点放在验证、示例、文档与发布质量。")


def _network_plot(point_table: pd.DataFrame, observation_table: pd.DataFrame, adjusted=None):
    coordinates = {
        str(row["name"]): (float(row["x"]), float(row["y"]))
        for _, row in point_table.iterrows()
    }
    if adjusted:
        coordinates.update(adjusted)

    fig, ax = plt.subplots()
    drawn = set()
    for _, row in observation_table.iterrows():
        station = str(row["from_point"])
        target = str(row["to_point"])
        if station in coordinates and target in coordinates:
            edge = tuple(sorted((station, target)))
            if edge not in drawn:
                x1, y1 = coordinates[station]
                x2, y2 = coordinates[target]
                ax.plot([x1, x2], [y1, y2], linewidth=0.8)
                drawn.add(edge)
        target2 = row.get("target2")
        if pd.notna(target2) and str(target2).strip() and station in coordinates:
            target2 = str(target2)
            if target2 in coordinates:
                edge = tuple(sorted((station, target2)))
                if edge not in drawn:
                    x1, y1 = coordinates[station]
                    x2, y2 = coordinates[target2]
                    ax.plot([x1, x2], [y1, y2], linewidth=0.8)
                    drawn.add(edge)

    fixed_lookup = {
        str(row["name"]): bool(row.get("fixed", False)) for _, row in point_table.iterrows()
    }
    for name, (x, y) in coordinates.items():
        marker = "s" if fixed_lookup.get(name, False) else "o"
        ax.scatter([x], [y], marker=marker)
        ax.annotate(name, (x, y))
    ax.set_aspect("equal", adjustable="datalim")
    ax.set_xlabel("X / East")
    ax.set_ylabel("Y / North")
    ax.set_title("Control network")
    return fig


def _traverse_plot(coordinates):
    table = pd.DataFrame(coordinates, columns=["X", "Y"])
    fig, ax = plt.subplots()
    ax.plot(table["X"], table["Y"], marker="o")
    for index, row in table.iterrows():
        ax.annotate(str(index), (row["X"], row["Y"]))
    ax.set_aspect("equal", adjustable="datalim")
    ax.set_xlabel("X / East")
    ax.set_ylabel("Y / North")
    ax.set_title("Adjusted traverse")
    return table, fig


def _parse_matrix_text(text: str) -> list[list[float]]:
    return [
        [float(value.strip()) for value in row.split(",")]
        for row in text.splitlines()
        if row.strip()
    ]


def _adjustment_excel_bytes(result) -> bytes:
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        for sheet_name, table in adjustment_tables(result).items():
            table.to_excel(writer, sheet_name=sheet_name[:31], index=False)
    return buffer.getvalue()


def _control_example_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    points = pd.DataFrame(
        {
            "name": ["A", "B", "C", "P"],
            "x": [0.0, 100.0, 0.0, 39.0],
            "y": [0.0, 0.0, 100.0, 31.0],
            "fixed": [True, True, True, False],
        }
    )
    observations = pd.DataFrame(
        {
            "kind": ["distance", "distance", "distance"],
            "from_point": ["A", "B", "C"],
            "to_point": ["P", "P", "P"],
            "target2": ["", "", ""],
            "value": [50.0, math.hypot(60.0, 30.0), math.hypot(40.0, 70.0)],
            "sigma": [0.01, 0.01, 0.01],
        }
    )
    return points, observations


def _song_independent_example():
    A = np.array(
        [
            [1.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0],
            [-1.0, 1.0, 0.0],
            [0.0, 1.0, -1.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, 1.0],
        ]
    )
    L = np.array([0.0, -6.0, 0.0, 3.0, 0.0, -9.0])
    P = np.array([1.0, 1.0, 2.0, 1.0, 2.0, 2.0])
    return A, L, P, np.array([2.0, 1.0, -4.0]), np.array([2.0, 4.0, -1.0, 2.0, -4.0, 5.0])


def _song_correlated_example():
    A = np.array(
        [
            [1.0, 0.0, 0.0],
            [-2.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [1.0, 0.0, -1.0],
            [0.0, -1.0, 2.0],
            [0.0, 0.0, 1.0],
        ]
    )
    L = np.array([0.0, -6.0, 6.0, 3.0, -3.0, -18.0])
    P = np.array(
        [
            [7.5, 6.5, 5.5, 3.5, 2.5, 0.5],
            [6.5, 6.5, 5.5, 3.5, 2.5, 0.5],
            [5.5, 5.5, 5.5, 3.5, 2.5, 0.5],
            [3.5, 3.5, 3.5, 3.5, 2.5, 0.5],
            [2.5, 2.5, 2.5, 2.5, 2.5, 0.5],
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        ]
    )
    return A, L, P, np.array([2.0, 1.0, -4.0]), np.array([2.0, 2.0, -5.0, 3.0, -6.0, 14.0])


def _example_downloads():
    point_table, observation_table = _control_example_tables()
    leveling_fixed = pd.DataFrame({"name": ["BM"], "height": [100.0]})
    leveling_observations = pd.DataFrame(
        {
            "from_point": ["BM", "A", "BM"],
            "to_point": ["A", "B", "B"],
            "height_difference": [1.0, 2.0, 3.001],
            "sigma": [0.001, 0.002, 0.0015],
        }
    )
    traverse = pd.DataFrame(
        {
            "angle_deg": [90.01, 89.99, 90.02, 89.98],
            "distance": [100.02, 99.98, 100.01, 99.99],
        }
    )
    common_points = pd.DataFrame(
        {
            "x": [0.0, 100.0, 0.0, 100.0],
            "y": [0.0, 0.0, 100.0, 100.0],
            "X": [1000.0, 1100.0161915448784, 999.1271719194526, 1099.143363464331],
            "Y": [2000.0, 2000.8728280805474, 2100.0161915448784, 2100.8890196254256],
        }
    )
    return {
        "control_points.csv": point_table,
        "control_observations.csv": observation_table,
        "leveling_fixed.csv": leveling_fixed,
        "leveling_observations.csv": leveling_observations,
        "traverse_angles.csv": traverse,
        "common_points.csv": common_points,
    }


if page == "首页":
    st.subheader("一个小而完整的传统测量计算工具箱")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("核心版本", __version__)
    c2.metric("控制网", "2D")
    c3.metric("质量控制", "Qvv / 冗余度")
    c4.metric("界面", "Streamlit")

    st.markdown(
        """
当前版本重点覆盖：**导线、水准、交会/后方交会、二维控制网、自由网、抗差、粗差筛查、误差椭圆、坐标转换、常用工程计算和基础数据导入**。

0.3.0 阶段不继续扩大仪器品牌格式或工程测量模块，而是优先保证 **可验证、可示例、可安装、可发布**。
"""
    )

    left, right = st.columns(2)
    with left:
        st.markdown("### 安装")
        st.code("pip install pysurveying", language="bash")
        st.markdown("### 启动可视化界面")
        st.code('pip install "pysurveying[ui]"\npysurveying-ui', language="bash")
    with right:
        st.markdown("### 推荐工作流")
        st.markdown(
            "1. 准备点表与观测表\n2. 选择计算/平差模块\n3. 查看残差、冗余度和点位精度\n4. 导出结果或继续粗差筛查"
        )
        st.markdown("### 标准算例")
        st.markdown(
            "内置《测量平差程序设计》3.1.5 独立观测参数平差和 3.2.5 相关观测参数平差，可在 **平差与质量 → 教材算例** 直接运行。"
        )

    st.info(
        "结果用于教学、科研、工程数据检查和小型控制网计算。正式生产、法定测量或高等级控制测量应按适用规范独立复核。"
    )

elif page == "基础计算":
    st.subheader("坐标正反算")
    col1, col2 = st.columns(2)
    with col1:
        x1 = st.number_input("X1", value=1000.0)
        y1 = st.number_input("Y1", value=1000.0)
    with col2:
        x2 = st.number_input("X2", value=1100.0)
        y2 = st.number_input("Y2", value=1050.0)

    m1, m2 = st.columns(2)
    m1.metric("两点距离", f"{distance((x1, y1), (x2, y2)):.4f}")
    m2.metric("坐标方位角", f"{azimuth((x1, y1), (x2, y2)):.6f}°")

    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        forward_azimuth = st.number_input("正算方位角(°)", value=30.0)
    with col2:
        forward_distance = st.number_input("正算距离", value=100.0)
    if st.button("坐标正算"):
        try:
            x, y = forward_coordinate(x1, y1, forward_azimuth, forward_distance)
            st.success(f"X={x:.4f}, Y={y:.4f}")
        except ValueError as exc:
            st.error(str(exc))

elif page == "交会与后方交会":
    tab1, tab2, tab3 = st.tabs(["前方交会", "距离交会", "后方交会"])
    with tab1:
        p1x = st.number_input("P1 X", value=0.0, key="f1x")
        p1y = st.number_input("P1 Y", value=0.0, key="f1y")
        a1 = st.number_input("P1 方位角", value=45.0)
        p2x = st.number_input("P2 X", value=100.0, key="f2x")
        p2y = st.number_input("P2 Y", value=0.0, key="f2y")
        a2 = st.number_input("P2 方位角", value=315.0)
        if st.button("计算前方交会"):
            try:
                x, y = forward_intersection((p1x, p1y), a1, (p2x, p2y), a2)
                st.success(f"P=({x:.4f}, {y:.4f})")
            except ValueError as exc:
                st.error(str(exc))

    with tab2:
        p1x = st.number_input("P1 X", value=0.0, key="d1x")
        p1y = st.number_input("P1 Y", value=0.0, key="d1y")
        r1 = st.number_input("P1 距离", value=70.710678)
        p2x = st.number_input("P2 X", value=100.0, key="d2x")
        p2y = st.number_input("P2 Y", value=0.0, key="d2y")
        r2 = st.number_input("P2 距离", value=70.710678, key="r2")
        if st.button("计算距离交会"):
            try:
                q1, q2 = distance_intersection((p1x, p1y), r1, (p2x, p2y), r2)
                st.write("解 1", q1)
                st.write("解 2", q2)
            except ValueError as exc:
                st.error(str(exc))

    with tab3:
        st.caption("每行：X,Y,观测方向(°)，至少 3 个已知点。")
        text = st.text_area(
            "已知点与方向",
            "0,0,225\n100,0,135\n100,100,45\n0,100,315",
        )
        if st.button("计算后方交会"):
            try:
                rows = _parse_matrix_text(text)
                station = resection(
                    [(row[0], row[1]) for row in rows],
                    [row[2] for row in rows],
                )
                st.success(
                    f"X={station[0]:.4f}, Y={station[1]:.4f}, 定向={station[2]:.6f}°"
                )
            except (ValueError, RuntimeError) as exc:
                st.error(str(exc))

elif page == "导线":
    st.subheader("导线计算")
    tab1, tab2 = st.tabs(["已知方位角", "内角闭合导线"])

    with tab1:
        mode = st.radio("导线类型", ["闭合导线", "附合导线"], horizontal=True)
        sx = st.number_input("起点 X", value=1000.0, key="t1sx")
        sy = st.number_input("起点 Y", value=1000.0, key="t1sy")
        end = None
        if mode == "附合导线":
            ex = st.number_input("终点 X", value=1200.0)
            ey = st.number_input("终点 Y", value=1200.0)
            end = (ex, ey)
        table = st.data_editor(
            pd.DataFrame(
                {
                    "azimuth_deg": [90.0, 0.0, 270.0, 180.0],
                    "distance": [100.0, 100.0, 100.0, 100.0],
                }
            ),
            num_rows="dynamic",
            use_container_width=True,
            key="traverse_azimuths",
        )
        if st.button("平差导线", key="traverse_by_azimuth"):
            try:
                if mode == "闭合导线":
                    result = closed_traverse((sx, sy), table.azimuth_deg, table.distance)
                else:
                    result = connected_traverse((sx, sy), end, table.azimuth_deg, table.distance)
                c1, c2, c3 = st.columns(3)
                c1.metric("fx", f"{result['misclosure_x']:.6f}")
                c2.metric("fy", f"{result['misclosure_y']:.6f}")
                ratio = result["relative_precision"]
                c3.metric("相对精度", "∞" if math.isinf(ratio) else f"1:{ratio:.0f}")
                coordinates, fig = _traverse_plot(result["coordinates"])
                st.dataframe(coordinates, use_container_width=True)
                st.pyplot(fig)
            except ValueError as exc:
                st.error(str(exc))

    with tab2:
        st.caption("先平差内角闭合差，再推算方位角，最后用 Bowditch 分配坐标闭合差。")
        sx = st.number_input("起点 X", value=0.0, key="t2sx")
        sy = st.number_input("起点 Y", value=0.0, key="t2sy")
        start_azimuth = st.number_input("第一边方位角(°)", value=90.0)
        turn = st.radio("转角方向", ["right", "left"], horizontal=True)
        table = st.data_editor(
            pd.DataFrame(
                {
                    "angle_deg": [90.01, 89.99, 90.02, 89.98],
                    "distance": [100.02, 99.98, 100.01, 99.99],
                }
            ),
            num_rows="dynamic",
            use_container_width=True,
            key="traverse_angles",
        )
        if st.button("角度与坐标联合计算"):
            try:
                result = closed_traverse_from_angles(
                    (sx, sy),
                    start_azimuth,
                    table.angle_deg,
                    table.distance,
                    turn=turn,
                )
                angle_result = result["angle_adjustment"]
                c1, c2, c3 = st.columns(3)
                c1.metric("角度闭合差", f"{angle_result['misclosure']:.6f}°")
                c2.metric("坐标闭合差", f"{result['linear_misclosure']:.6f}")
                ratio = result["relative_precision"]
                c3.metric("相对精度", "∞" if math.isinf(ratio) else f"1:{ratio:.0f}")
                angle_table = pd.DataFrame(
                    {
                        "观测角": table.angle_deg,
                        "改正数": angle_result["corrections"],
                        "平差角": angle_result["adjusted_angles"],
                        "边方位角": result["azimuths"],
                    }
                )
                st.dataframe(angle_table, use_container_width=True)
                coordinates, fig = _traverse_plot(result["coordinates"])
                st.dataframe(coordinates, use_container_width=True)
                st.pyplot(fig)
            except ValueError as exc:
                st.error(str(exc))

elif page == "水准":
    st.subheader("水准测量")
    tab1, tab2 = st.tabs(["水准路线", "水准网"])

    with tab1:
        h0 = st.number_input("起点高程", value=10.0)
        has_end = st.checkbox("已知终点高程", value=True)
        hend = st.number_input("终点高程", value=10.0) if has_end else None
        table = st.data_editor(
            pd.DataFrame({"dh": [1.002, -0.501, -0.503], "length": [1.0, 1.0, 1.0]}),
            num_rows="dynamic",
            use_container_width=True,
            key="level_route",
        )
        if st.button("平差水准路线"):
            try:
                result = leveling_route(h0, table.dh, end_height=hend, lengths=table.length)
                st.metric("闭合差", f"{result['misclosure']:.6f}")
                output = pd.DataFrame(
                    {
                        "point": range(len(result["heights"])),
                        "height": result["heights"],
                    }
                )
                st.dataframe(output, use_container_width=True)
            except ValueError as exc:
                st.error(str(exc))

    with tab2:
        st.caption("高差定义为 H_to - H_from；sigma 为高差标准差。默认数据为不等权冗余水准网。")
        fixed = st.data_editor(
            pd.DataFrame({"name": ["BM"], "height": [100.0]}),
            num_rows="dynamic",
            use_container_width=True,
            key="level_fixed",
        )
        observations_table = st.data_editor(
            pd.DataFrame(
                {
                    "from_point": ["BM", "A", "BM"],
                    "to_point": ["A", "B", "B"],
                    "dh": [1.000, 2.000, 3.001],
                    "sigma": [0.001, 0.002, 0.0015],
                }
            ),
            num_rows="dynamic",
            use_container_width=True,
            key="level_network",
        )
        if st.button("平差水准网"):
            try:
                fixed_heights = {
                    str(row["name"]): float(row["height"]) for _, row in fixed.iterrows()
                }
                level_observations = [
                    LevelObservation(
                        str(row["from_point"]),
                        str(row["to_point"]),
                        float(row["dh"]),
                        float(row["sigma"]),
                    )
                    for _, row in observations_table.iterrows()
                ]
                result = leveling_network(level_observations, fixed_heights)
                c1, c2 = st.columns(2)
                c1.metric("σ₀", "—" if result.sigma0 is None else f"{result.sigma0:.6f}")
                c2.metric("自由度", result.dof)
                heights = pd.DataFrame(
                    [
                        {"name": name, "height": height}
                        for name, height in result.metadata["adjusted_heights"].items()
                    ]
                )
                st.dataframe(heights, use_container_width=True)
                st.write("残差", result.residuals)
                st.download_button(
                    "下载水准网结果 Excel",
                    _adjustment_excel_bytes(result),
                    file_name="leveling_adjustment.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            except (ValueError, KeyError) as exc:
                st.error(str(exc))

elif page == "控制网":
    st.subheader("二维控制网平差")
    st.caption(
        "支持 distance、azimuth、direction、angle。direction 自动估计测站定向未知数；"
        "azimuth 表示绝对方位角。"
    )
    free_network = st.checkbox("自由网（最小范数）", value=False)
    robust_network = st.checkbox("Huber 抗差", value=False, disabled=free_network)
    huber_k = st.number_input("Huber k", min_value=0.1, value=1.5, disabled=not robust_network)
    threshold = st.number_input("质量控制阈值 |w|", min_value=0.1, value=3.0)
    run_snooping = st.checkbox(
        "同时执行迭代粗差筛查",
        value=False,
        disabled=free_network or robust_network,
        help="使用普通平差的标准化残差逐次定位最大可疑观测。",
    )

    default_points, default_observations = _control_example_tables()
    point_table = st.data_editor(
        default_points,
        num_rows="dynamic",
        use_container_width=True,
        key="network_points",
    )
    observation_table = st.data_editor(
        default_observations,
        num_rows="dynamic",
        use_container_width=True,
        key="network_observations",
    )

    if st.button("平差控制网", type="primary"):
        try:
            points = [
                Point(
                    str(row["name"]),
                    float(row["x"]),
                    float(row["y"]),
                    fixed=False if free_network else bool(row["fixed"]),
                )
                for _, row in point_table.iterrows()
            ]
            observations = []
            for _, row in observation_table.iterrows():
                target2 = row.get("target2")
                target2 = None if pd.isna(target2) or not str(target2).strip() else str(target2)
                observations.append(
                    Observation(
                        kind=str(row["kind"]),
                        from_point=str(row["from_point"]),
                        to_point=str(row["to_point"]),
                        target2=target2,
                        value=float(row["value"]),
                        sigma=float(row["sigma"]),
                    )
                )

            if free_network:
                result = adjust_free_network(points, observations)
            elif robust_network:
                result = adjust_control_network_robust(points, observations, huber_k=huber_k)
            else:
                result = adjust_control_network(points, observations)

            adjusted = result.metadata["adjusted_points"]
            output = pd.DataFrame(
                [{"name": name, "x": xy[0], "y": xy[1]} for name, xy in adjusted.items()]
            )
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("收敛", "是" if result.converged else "否")
            c2.metric("迭代次数", result.iterations)
            c3.metric("自由度", result.dof)
            c4.metric("σ₀", "—" if result.sigma0 is None else f"{result.sigma0:.6f}")

            tab_result, tab_quality, tab_precision, tab_plot = st.tabs(
                ["平差坐标", "观测质量", "点位精度", "网图"]
            )
            with tab_result:
                st.dataframe(output, use_container_width=True)
                if result.metadata.get("orientations"):
                    st.write("测站定向参数", result.metadata["orientations"])
                if robust_network:
                    st.write("Huber 等价权", result.metadata["robust_weights"])
                st.download_button(
                    "下载控制网结果 Excel",
                    _adjustment_excel_bytes(result),
                    file_name="control_network_adjustment.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            with tab_quality:
                quality_rows = control_network_quality(result, observations, threshold=threshold)
                st.dataframe(pd.DataFrame(quality_rows), use_container_width=True)
                st.caption("角度类观测的原始残差单位为 degree；距离类观测使用坐标线性单位。")
            with tab_precision:
                precision_rows = control_network_precision(result)
                st.dataframe(pd.DataFrame(precision_rows), use_container_width=True)
                if free_network:
                    st.warning("自由网点位协方差依赖当前最小范数基准实现；内部几何比绝对点位精度更适合比较。")
            with tab_plot:
                st.pyplot(_network_plot(point_table, observation_table, adjusted))

            if run_snooping:
                st.markdown("### 迭代粗差筛查")
                report = control_network_data_snooping(
                    points,
                    observations,
                    threshold=threshold,
                    max_removals=3,
                )
                st.write("停止原因", report["stopped_reason"])
                st.write("剔除的原始观测序号", report["removed_indices"])
                st.dataframe(pd.DataFrame(report["history"]), use_container_width=True)
        except (ValueError, KeyError, RuntimeError, np.linalg.LinAlgError) as exc:
            st.error(str(exc))

elif page == "平差与质量":
    st.subheader("线性平差、教材算例与质量控制")
    tab1, tab2 = st.tabs(["通用线性平差", "教材算例"])

    with tab1:
        st.caption("A：逗号分隔列、换行分隔行；L：每行一个值。")
        a_text = st.text_area("A", "1\n1\n1\n1\n1")
        l_text = st.text_area("L", "10.00\n10.00\n10.00\n10.00\n20.00")
        robust = st.checkbox("Huber 抗差线性平差", value=False)
        threshold = st.number_input("标准化残差阈值", min_value=0.1, value=3.0, key="ls_threshold")
        if st.button("计算线性平差"):
            try:
                matrix = np.array(_parse_matrix_text(a_text), dtype=float)
                vector = np.array(
                    [float(value.strip()) for value in l_text.splitlines() if value.strip()],
                    dtype=float,
                )
                result = robust_least_squares(matrix, vector) if robust else least_squares(matrix, vector)
                c1, c2 = st.columns(2)
                c1.metric("自由度", result.dof)
                c2.metric("σ₀", "—" if result.sigma0 is None else f"{result.sigma0:.6f}")
                st.write("参数", result.parameters)
                st.write("残差", result.residuals)
                if not robust:
                    screening = pd.DataFrame(data_snooping(result, threshold=threshold))
                    st.write("粗差筛查")
                    st.dataframe(screening, use_container_width=True)

                if result.covariance is not None and result.covariance.shape[0] >= 2:
                    ellipse = error_ellipse(result.covariance[:2, :2])
                    st.write("前两个参数的 95% 误差椭圆", ellipse)
                    fig, ax = plt.subplots()
                    patch = Ellipse(
                        (0, 0),
                        width=2 * ellipse["semi_major"],
                        height=2 * ellipse["semi_minor"],
                        angle=90 - ellipse["azimuth"],
                        fill=False,
                    )
                    ax.add_patch(patch)
                    ax.autoscale_view()
                    ax.set_aspect("equal")
                    st.pyplot(fig)
            except (ValueError, np.linalg.LinAlgError) as exc:
                st.error(str(exc))

    with tab2:
        st.caption("来源：宋力杰《测量平差程序设计》3.1.5 与 3.2.5。仓库测试对教材印刷结果做精确数值回归。")
        example_name = st.radio(
            "选择算例",
            ["3.1.5 独立观测参数平差", "3.2.5 相关观测参数平差"],
        )
        if example_name.startswith("3.1.5"):
            A, L, P, expected_x, expected_v = _song_independent_example()
        else:
            A, L, P, expected_x, expected_v = _song_correlated_example()

        left, right = st.columns(2)
        with left:
            st.write("A")
            st.dataframe(pd.DataFrame(A), use_container_width=True)
            st.write("L")
            st.dataframe(pd.DataFrame({"L": L}), use_container_width=True)
        with right:
            st.write("P")
            if np.asarray(P).ndim == 1:
                st.dataframe(pd.DataFrame({"weight": P}), use_container_width=True)
            else:
                st.dataframe(pd.DataFrame(P), use_container_width=True)

        result = least_squares(A, L, P=P)
        checks = {
            "参数 X": np.allclose(result.parameters, expected_x, atol=1e-10),
            "残差 V": np.allclose(result.residuals, expected_v, atol=1e-10),
            "单位权中误差 σ₀=6": result.sigma0 is not None and np.isclose(result.sigma0, 6.0),
        }
        st.write("计算参数", result.parameters)
        st.write("计算残差", result.residuals)
        st.write("Qxx", result.metadata["qxx"])
        st.metric("σ₀", "—" if result.sigma0 is None else f"{result.sigma0:.6f}")
        if all(checks.values()):
            st.success("教材印刷结果复现通过")
        else:
            st.error("教材算例结果与预期值不一致")
        st.dataframe(
            pd.DataFrame([{"检查项": name, "通过": passed} for name, passed in checks.items()]),
            use_container_width=True,
        )

elif page == "坐标转换":
    st.subheader("坐标转换")
    tab1, tab2, tab3 = st.tabs(["CRS", "四/六参数", "本地 ENU"])

    with tab1:
        x = st.number_input("X / 经度", value=118.7969, format="%.8f")
        y = st.number_input("Y / 纬度", value=32.0603, format="%.8f")
        source = st.text_input("源 CRS", "EPSG:4326")
        target = st.text_input("目标 CRS", "EPSG:3857")
        if st.button("执行 CRS 转换"):
            try:
                xx, yy = transform_coordinates(x, y, source, target)
                st.success(f"X={xx:.4f}, Y={yy:.4f}")
            except Exception as exc:
                st.error(str(exc))

    with tab2:
        st.caption("输入同名点：x,y 为源坐标；X,Y 为目标坐标。默认数据由已知平移、比例尺和旋转生成。")
        common = st.data_editor(
            _example_downloads()["common_points.csv"],
            num_rows="dynamic",
            use_container_width=True,
            key="common_points",
        )
        model = st.radio("模型", ["四参数相似变换", "六参数仿射变换"], horizontal=True)
        if st.button("拟合转换参数"):
            try:
                source_points = common[["x", "y"]].to_numpy(float)
                target_points = common[["X", "Y"]].to_numpy(float)
                result = (
                    fit_similarity_2d(source_points, target_points)
                    if model == "四参数相似变换"
                    else fit_affine_2d(source_points, target_points)
                )
                st.write("参数", result["parameters"])
                st.metric("同名点 RMSE", f"{result['rmse']:.6f}")
                if model == "四参数相似变换":
                    st.write(
                        {
                            "平移 X": result["tx"],
                            "平移 Y": result["ty"],
                            "比例尺": result["scale"],
                            "旋转角(°)": result["rotation_deg"],
                        }
                    )
                st.dataframe(
                    pd.DataFrame(result["residuals"], columns=["vX", "vY"]),
                    use_container_width=True,
                )
            except (ValueError, np.linalg.LinAlgError) as exc:
                st.error(str(exc))

    with tab3:
        st.caption("WGS84 经纬度/椭球高 → 以指定原点建立的 East-North-Up。")
        lon = st.number_input("目标经度", value=118.7970, format="%.8f")
        lat = st.number_input("目标纬度", value=32.0604, format="%.8f")
        height = st.number_input("目标椭球高", value=30.0)
        lon0 = st.number_input("原点经度", value=118.7969, format="%.8f")
        lat0 = st.number_input("原点纬度", value=32.0603, format="%.8f")
        height0 = st.number_input("原点椭球高", value=25.0)
        if st.button("计算 ENU"):
            try:
                east, north, up = geodetic_to_enu(lon, lat, height, lon0, lat0, height0)
                st.success(f"E={east:.4f} m, N={north:.4f} m, U={up:.4f} m")
            except ValueError as exc:
                st.error(str(exc))

elif page == "工程测量":
    st.subheader("工程测量常用计算")
    st.caption("当前版本保持轻量范围，不继续扩展线路曲线、土方、变形监测等大型工程模块。")
    tab1, tab2, tab3, tab4 = st.tabs(["极坐标放样", "里程偏距", "坡度高程", "面积"])

    with tab1:
        sx = st.number_input("测站 X", value=1000.0, key="esx")
        sy = st.number_input("测站 Y", value=1000.0, key="esy")
        tx = st.number_input("目标 X", value=1100.0, key="etx")
        ty = st.number_input("目标 Y", value=1050.0, key="ety")
        st.write(polar_stakeout((sx, sy), (tx, ty)))

    with tab2:
        start_x = st.number_input("基线起点 X", value=0.0)
        start_y = st.number_input("基线起点 Y", value=0.0)
        end_x = st.number_input("基线终点 X", value=0.0)
        end_y = st.number_input("基线终点 Y", value=100.0)
        px = st.number_input("待求点 X", value=3.0)
        py = st.number_input("待求点 Y", value=50.0)
        st.write(chainage_offset((px, py), (start_x, start_y), (end_x, end_y)))

    with tab3:
        horizontal = st.number_input("水平距离", value=100.0)
        dh = st.number_input("高差", value=2.0)
        st.write(f"坡度：{slope(horizontal, dh):.4f}%")
        start_height = st.number_input("设计起点高程", value=100.0)
        grade = st.number_input("设计坡度(%)", value=2.0)
        chainage = st.number_input("设计距离", value=50.0)
        st.write(f"设计高程：{grade_elevation(start_height, chainage, grade):.4f}")

    with tab4:
        points_text = st.text_area("多边形点，每行 X,Y", "0,0\n10,0\n10,10\n0,10")
        if st.button("计算面积"):
            try:
                coordinates = _parse_matrix_text(points_text)
                st.success(f"面积：{polygon_area(coordinates):.4f}")
            except ValueError as exc:
                st.error(str(exc))

elif page == "数据与示例":
    st.subheader("数据导入与示例数据")
    tab1, tab2 = st.tabs(["导入文件", "下载示例数据"])

    with tab1:
        st.caption("支持 CSV、XLSX、LandXML/XML、Leica GSI；不在 0.3.0 继续新增仪器品牌格式。")
        uploaded = st.file_uploader(
            "选择文件",
            type=["csv", "xlsx", "xlsm", "xml", "landxml", "gsi", "gsi8", "gsi16"],
        )
        if uploaded is not None:
            suffix = Path(uploaded.name).suffix.lower()
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
                temp.write(uploaded.getvalue())
                temp_path = Path(temp.name)
            try:
                data = read_points(temp_path)
                st.dataframe(data, use_container_width=True)
                st.caption(f"读取 {len(data)} 条记录")
                st.download_button(
                    "导出为 CSV",
                    data.to_csv(index=False).encode("utf-8-sig"),
                    file_name=f"{Path(uploaded.name).stem}_normalized.csv",
                    mime="text/csv",
                )
            except (ValueError, OSError) as exc:
                st.error(str(exc))
            finally:
                temp_path.unlink(missing_ok=True)

    with tab2:
        st.markdown(
            "这些 CSV 与仓库 `examples/data/` 保持相同结构，并由自动测试实际执行，适合直接改数值学习。"
        )
        for file_name, data in _example_downloads().items():
            st.markdown(f"**{file_name}**")
            st.dataframe(data, use_container_width=True)
            st.download_button(
                f"下载 {file_name}",
                data.to_csv(index=False).encode("utf-8-sig"),
                file_name=file_name,
                mime="text/csv",
                key=f"download_{file_name}",
            )
