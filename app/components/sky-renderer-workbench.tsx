"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ObserverCoordinatePanel,
  SOLAR_X_PARSEC,
} from "@/app/components/observer-coordinate-lab";
import {
  galactocentricAzimuthDegrees,
  galactocentricRadiusParsec,
  normalizeDegrees,
} from "@/lib/physics/coordinates";
import { fluxRatioFromMagnitudeDifference } from "@/lib/physics/photometry";
import type { Vector3 } from "@/lib/physics/vector";
import { numericalBenchmarkEmitters } from "@/lib/rendering/benchmark-catalog";
import { projectNumericalBenchmark } from "@/lib/rendering/benchmark-renderer";
import type { RenderScope, ViewCamera } from "@/lib/rendering/contracts";
import { productionRenderBlockers } from "@/lib/rendering/production-gate";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function linearChannelToDisplay(channel: number): number {
  return Math.round(255 * clamp(channel ** (1 / 2.2), 0, 1));
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);
}

export function SkyRendererWorkbench() {
  const [scope, setScope] = useState<RenderScope>("production-galaxy");
  const [observerPositionParsec, setObserverPositionParsec] = useState<Vector3>({
    x: SOLAR_X_PARSEC,
    y: 0,
    z: 0,
  });
  const [camera, setCamera] = useState<ViewCamera>({
    azimuthDegrees: 0,
    elevationDegrees: 0,
    horizontalFieldOfViewDegrees: 90,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const radiusParsec = galactocentricRadiusParsec(observerPositionParsec);
  const positionAzimuthDegrees = galactocentricAzimuthDegrees(
    observerPositionParsec,
  );
  const cameraMemo = useMemo(() => camera, [camera]);
  const visibleEmitterCount = useMemo(
    () =>
      scope === "numerical-benchmark"
        ? projectNumericalBenchmark(
            numericalBenchmarkEmitters,
            observerPositionParsec,
            cameraMemo,
            1_000,
            500,
          ).length
        : 0,
    [cameraMemo, observerPositionParsec, scope],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#030708";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(142, 197, 199, 0.16)";
    context.lineWidth = pixelRatio;
    context.setLineDash([3 * pixelRatio, 7 * pixelRatio]);
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
    context.setLineDash([]);

    if (scope === "production-galaxy") {
      context.fillStyle = "rgba(238, 163, 156, 0.9)";
      context.font = `${12 * pixelRatio}px ui-monospace, monospace`;
      context.textAlign = "center";
      context.fillText("生产输出被科学制品门禁拒绝", width / 2, height / 2 - 16 * pixelRatio);
      context.fillStyle = "rgba(147, 165, 162, 0.9)";
      context.font = `${10 * pixelRatio}px ui-monospace, monospace`;
      context.fillText("画布只显示坐标准线，不显示替代星空", width / 2, height / 2 + 12 * pixelRatio);
      return;
    }

    const projected = projectNumericalBenchmark(
      numericalBenchmarkEmitters,
      observerPositionParsec,
      cameraMemo,
      width,
      height,
    );
    context.globalCompositeOperation = "lighter";
    for (const source of projected) {
      const fixedDetectorResponse = clamp(
        fluxRatioFromMagnitudeDifference(source.apparentVisualMagnitude - 8),
        0.03,
        1,
      );
      const [red, green, blue] = source.linearRgb.map(linearChannelToDisplay);
      const pointSpreadRadius = 6 * pixelRatio;
      const halo = context.createRadialGradient(
        source.canvasX,
        source.canvasY,
        0,
        source.canvasX,
        source.canvasY,
        pointSpreadRadius,
      );
      halo.addColorStop(
        0,
        `rgba(${red}, ${green}, ${blue}, ${0.32 * fixedDetectorResponse})`,
      );
      halo.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
      context.fillStyle = halo;
      context.fillRect(
        source.canvasX - pointSpreadRadius,
        source.canvasY - pointSpreadRadius,
        pointSpreadRadius * 2,
        pointSpreadRadius * 2,
      );
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.25 + 0.75 * fixedDetectorResponse})`;
      context.fillRect(
        Math.round(source.canvasX),
        Math.round(source.canvasY),
        Math.max(1, pixelRatio),
        Math.max(1, pixelRatio),
      );
    }
    context.globalCompositeOperation = "source-over";
  }, [cameraMemo, observerPositionParsec, scope]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [draw]);

  const lookTowardCentre = () => {
    const planarDistance = Math.hypot(
      observerPositionParsec.x,
      observerPositionParsec.y,
    );
    setCamera((current) => ({
      ...current,
      azimuthDegrees: normalizeDegrees(
        (Math.atan2(-observerPositionParsec.y, -observerPositionParsec.x) * 180) /
          Math.PI,
      ),
      elevationDegrees:
        (Math.atan2(-observerPositionParsec.z, planarDistance) * 180) / Math.PI,
    }));
  };

  const lookTowardOuterGalaxy = () => {
    const planarDistance = Math.hypot(
      observerPositionParsec.x,
      observerPositionParsec.y,
    );
    setCamera((current) => ({
      ...current,
      azimuthDegrees: positionAzimuthDegrees,
      elevationDegrees:
        (Math.atan2(observerPositionParsec.z, planarDistance) * 180) / Math.PI,
    }));
  };

  return (
    <div className="renderer-workbench">
      <div className="renderer-toolbar" role="group" aria-label="渲染范围">
        <div>
          <span className="eyebrow">星空渲染器</span>
          <strong>工作链路 0.3</strong>
        </div>
        <div className="scope-switch">
          <button
            type="button"
            className={scope === "production-galaxy" ? "is-active" : ""}
            onClick={() => setScope("production-galaxy")}
          >
            生产银河天空
          </button>
          <button
            type="button"
            className={scope === "numerical-benchmark" ? "is-active benchmark" : ""}
            onClick={() => setScope("numerical-benchmark")}
          >
            <span>数值核验场</span>
            <small>非银河预测</small>
          </button>
        </div>
      </div>

      <div className="renderer-main-grid">
        <section className="sky-viewport" aria-labelledby="sky-viewport-title">
          <div className="sky-viewport-heading">
            <div>
              <h3 id="sky-viewport-title">
                {scope === "production-galaxy" ? "全天视图 · 生产门禁" : "视锥投影 · 非银河预测"}
              </h3>
              <p>
                {scope === "production-galaxy"
                  ? "缺少真实制品时，渲染调用以类型化错误结束；黑色区域不是一张天空贴图。"
                  : "数值核验场是用于验证算法的固定定标源集合，不是恒星目录，也不表达银河密度、尘埃或未分辨辉光。"}
              </p>
            </div>
            <span className={scope === "production-galaxy" ? "status status-locked" : "status benchmark-status"}>
              {scope === "production-galaxy" ? "生产锁定" : "仅限核验"}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            className="sky-canvas"
            aria-label={scope === "production-galaxy" ? "已锁定的生产银河天空画布" : "非银河预测的确定性数值核验画布"}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              pointerRef.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              const previous = pointerRef.current;
              if (!previous) return;
              const deltaX = event.clientX - previous.x;
              const deltaY = event.clientY - previous.y;
              pointerRef.current = { x: event.clientX, y: event.clientY };
              setCamera((current) => ({
                ...current,
                azimuthDegrees: normalizeDegrees(current.azimuthDegrees + deltaX * 0.22),
                elevationDegrees: clamp(current.elevationDegrees - deltaY * 0.22, -89, 89),
              }));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              pointerRef.current = null;
            }}
            onPointerCancel={() => {
              pointerRef.current = null;
            }}
          />
          <div className="viewport-overlay" aria-hidden="true">
            <span>方位 {camera.azimuthDegrees.toFixed(1)}°</span>
            <span>仰角 {camera.elevationDegrees.toFixed(1)}°</span>
            <span>视场 {camera.horizontalFieldOfViewDegrees.toFixed(0)}°</span>
          </div>
          <p className="viewport-method">
            方位角（AZ）表示视线在银河盘面内从横向正轴转过的角度；仰角（EL）表示视线离开盘面的角度；水平视场角（FOV）表示画面横向覆盖的角宽，单位均为度。拖动画布只旋转视线。
          </p>
        </section>

        <aside className="renderer-control-stack" aria-label="渲染控制与诊断">
          <div className="control-block">
            <span className="control-title">观察方向</span>
            <div className="direction-buttons">
              <button type="button" onClick={lookTowardCentre}>看向中心</button>
              <button type="button" onClick={lookTowardOuterGalaxy}>看向外围</button>
              <button type="button" onClick={() => setCamera((current) => ({ ...current, elevationDegrees: 90 }))}>盘面上方</button>
              <button type="button" onClick={() => setCamera((current) => ({ ...current, elevationDegrees: -90 }))}>盘面下方</button>
            </div>
            <label className="range-control compact">
              <span className="range-heading"><span>水平视场角</span><output>{camera.horizontalFieldOfViewDegrees.toFixed(0)}°</output></span>
              <input type="range" min="20" max="140" step="1" value={camera.horizontalFieldOfViewDegrees} onChange={(event) => setCamera((current) => ({ ...current, horizontalFieldOfViewDegrees: Number(event.target.value) }))} />
            </label>
            <label className="range-control compact">
              <span className="range-heading"><span>盘面仰角</span><output>{camera.elevationDegrees.toFixed(0)}°</output></span>
              <input type="range" min="-90" max="90" step="1" value={camera.elevationDegrees} onChange={(event) => setCamera((current) => ({ ...current, elevationDegrees: Number(event.target.value) }))} />
            </label>
          </div>

          <div className="control-block locked-control-block">
            <span className="control-title">观测响应</span>
            <div className="mode-buttons" aria-label="观测模式尚未解锁">
              {[
                ["裸眼", "需要明视觉响应制品"],
                ["暗适应", "需要暗视觉响应制品"],
                ["相机", "需要传感器、光圈与噪声制品"],
              ].map(([label, reason]) => (
                <button key={label} type="button" disabled title={reason}>{label}<small>{reason}</small></button>
              ))}
            </div>
            <p>观测响应表示光通量经过眼睛或相机后形成信号的规律；它与改变曝光来伪造位置效果不同。</p>
          </div>

          <div className="control-block locked-control-block">
            <span className="control-title">模拟时间</span>
            <button className="locked-time" type="button" disabled>时间推进锁定 · 缺六维观察者状态</button>
            <p>六维观察者状态同时包含三个位置量和三个速度量；缺少速度时，地图拖动只能是探针重定位，不能冒充轨道运动。</p>
          </div>

          <div className="diagnostic-block">
            <span className="control-title">物理验证读数</span>
            <dl>
              <div><dt>观察者坐标</dt><dd>{formatNumber(observerPositionParsec.x)} / {formatNumber(observerPositionParsec.y)} / {formatNumber(observerPositionParsec.z)} 秒差距</dd></div>
              <div><dt>中心距离</dt><dd>{formatNumber(radiusParsec)} 秒差距</dd></div>
              <div><dt>银河方位</dt><dd>{positionAzimuthDegrees.toFixed(2)}°</dd></div>
              <div><dt>核验源</dt><dd>{scope === "numerical-benchmark" ? `${visibleEmitterCount} / ${numericalBenchmarkEmitters.length} 进入当前视锥` : "不注入"}</dd></div>
              <div><dt>尘埃消光</dt><dd>{scope === "numerical-benchmark" ? "0 等（本核验不验证尘埃）" : "制品缺失"}</dd></div>
              <div><dt>未分辨光</dt><dd>{scope === "numerical-benchmark" ? "不计算" : "制品缺失"}</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      {scope === "production-galaxy" ? (
        <div className="production-blockers" role="status">
          <strong>生产渲染调用失败关闭</strong>
          <ul>
            {productionRenderBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      ) : (
        <div className="benchmark-disclosure" role="status">
          <strong>非银河预测</strong>
          <p>定标源的位置、绝对星等和有效温度均为固定测试量；距离改变后，方向由三维相对向量重投影，视星等由距离模数重新计算。距离模数表示距离使视星等相对绝对星等增加的量。有效温度以开尔文（K）为单位，K 是绝对温标；红、绿、蓝三通道（RGB）颜色由温度的黑体光谱积分得到。</p>
          <p>每个核心保持一个显示像素；外围只用于验证点扩散函数（PSF），即点光源通过显示成像链后形成的扩散响应。响应宽度固定，不随银河中心距离改变。</p>
        </div>
      )}

      <ObserverCoordinatePanel
        positionParsec={observerPositionParsec}
        onPositionChange={setObserverPositionParsec}
        viewAzimuthDegrees={camera.azimuthDegrees}
        onViewAzimuthChange={(azimuthDegrees) =>
          setCamera((current) => ({ ...current, azimuthDegrees }))
        }
      />
    </div>
  );
}
