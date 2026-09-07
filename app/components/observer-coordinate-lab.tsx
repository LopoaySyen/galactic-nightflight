"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  galactocentricAzimuthDegrees,
  galactocentricRadiusParsec,
  updateFromPlanarPoint,
  updateRadiusPreservingAzimuth,
} from "@/lib/physics/coordinates";
import type { Vector3 } from "@/lib/physics/vector";

export const MINIMUM_RADIUS_PARSEC = 100;
export const MAXIMUM_RADIUS_PARSEC = 20_000;
export const SOLAR_RADIUS_PARSEC = 8_277;
export const SOLAR_X_PARSEC = -SOLAR_RADIUS_PARSEC;
const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 520;
const MAP_CENTRE_X = VIEWBOX_WIDTH / 2;
const MAP_CENTRE_Y = VIEWBOX_HEIGHT / 2;
const MAP_RADIUS_PIXELS = 226;

function radiusFromSlider(sliderValue: number): number {
  const ratio = MAXIMUM_RADIUS_PARSEC / MINIMUM_RADIUS_PARSEC;
  return MINIMUM_RADIUS_PARSEC * ratio ** sliderValue;
}

function sliderFromRadius(radiusParsec: number): number {
  return (
    Math.log(radiusParsec / MINIMUM_RADIUS_PARSEC) /
    Math.log(MAXIMUM_RADIUS_PARSEC / MINIMUM_RADIUS_PARSEC)
  );
}

function mapPointFromPosition(positionParsec: Vector3) {
  return {
    x:
      MAP_CENTRE_X +
      (positionParsec.x / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS_PIXELS,
    y:
      MAP_CENTRE_Y -
      (positionParsec.y / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS_PIXELS,
  };
}

function formatParsec(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: value < 1_000 ? 1 : 0,
  }).format(value);
}

interface ObserverCoordinatePanelProps {
  positionParsec: Vector3;
  onPositionChange: (positionParsec: Vector3) => void;
  viewAzimuthDegrees: number;
  onViewAzimuthChange: (azimuthDegrees: number) => void;
  truthLabel?: string;
}

export function ObserverCoordinatePanel({
  positionParsec,
  onPositionChange,
  viewAzimuthDegrees,
  onViewAzimuthChange,
  truthLabel = "与渲染器共享同一坐标",
}: ObserverCoordinatePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const radiusParsec = galactocentricRadiusParsec(positionParsec);
  const positionAzimuthDegrees = galactocentricAzimuthDegrees(positionParsec);
  const observerMapPoint = mapPointFromPosition(positionParsec);
  const sunMapPoint = mapPointFromPosition({ x: SOLAR_X_PARSEC, y: 0, z: 0 });
  const viewDirectionEnd = useMemo(() => {
    const radians = (viewAzimuthDegrees * Math.PI) / 180;
    return {
      x: observerMapPoint.x + Math.cos(radians) * 54,
      y: observerMapPoint.y - Math.sin(radians) * 54,
    };
  }, [observerMapPoint.x, observerMapPoint.y, viewAzimuthDegrees]);

  const setPositionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const bounds = svg.getBoundingClientRect();
      const svgX = ((clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH;
      const svgY = ((clientY - bounds.top) / bounds.height) * VIEWBOX_HEIGHT;
      const requestedX =
        ((svgX - MAP_CENTRE_X) / MAP_RADIUS_PIXELS) * MAXIMUM_RADIUS_PARSEC;
      const requestedY =
        ((MAP_CENTRE_Y - svgY) / MAP_RADIUS_PIXELS) * MAXIMUM_RADIUS_PARSEC;
      const update = updateFromPlanarPoint(
        requestedX,
        requestedY,
        MINIMUM_RADIUS_PARSEC,
        MAXIMUM_RADIUS_PARSEC,
        positionAzimuthDegrees,
      );
      onPositionChange(update.positionParsec);
    },
    [onPositionChange, positionAzimuthDegrees],
  );

  return (
    <div className="observer-lab">
      <div className="observer-map-wrap">
        <div className="panel-label-row">
          <span className="eyebrow">观察者几何</span>
          <span className="truth-tag">{truthLabel}</span>
        </div>
        <svg
          ref={svgRef}
          className={`observer-map ${isDragging ? "is-dragging" : ""}`}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          role="img"
          aria-label="银河盘面观察者坐标图。点击或拖动可改变观察者位置。"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDragging(true);
            setPositionFromPointer(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (isDragging) setPositionFromPointer(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setIsDragging(false);
          }}
          onPointerCancel={() => setIsDragging(false)}
        >
          <defs>
            <radialGradient id="discFade">
              <stop offset="0" stopColor="#8ec5c7" stopOpacity="0.09" />
              <stop offset="1" stopColor="#8ec5c7" stopOpacity="0.015" />
            </radialGradient>
            <marker
              id="arrowHead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#f0b866" />
            </marker>
          </defs>
          <circle
            cx={MAP_CENTRE_X}
            cy={MAP_CENTRE_Y}
            r={MAP_RADIUS_PIXELS}
            fill="url(#discFade)"
            className="map-disc-edge"
          />
          {[5_000, 10_000, 15_000, 20_000].map((ring) => (
            <circle
              key={ring}
              cx={MAP_CENTRE_X}
              cy={MAP_CENTRE_Y}
              r={(ring / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS_PIXELS}
              className="map-ring"
            />
          ))}
          <line
            x1={MAP_CENTRE_X - MAP_RADIUS_PIXELS}
            y1={MAP_CENTRE_Y}
            x2={MAP_CENTRE_X + MAP_RADIUS_PIXELS}
            y2={MAP_CENTRE_Y}
            className="map-axis"
          />
          <line
            x1={MAP_CENTRE_X}
            y1={MAP_CENTRE_Y - MAP_RADIUS_PIXELS}
            x2={MAP_CENTRE_X}
            y2={MAP_CENTRE_Y + MAP_RADIUS_PIXELS}
            className="map-axis"
          />
          <circle cx={MAP_CENTRE_X} cy={MAP_CENTRE_Y} r="5" className="map-centre" />
          <text x={MAP_CENTRE_X + 12} y={MAP_CENTRE_Y - 12} className="map-label">
            银河中心
          </text>
          <circle cx={sunMapPoint.x} cy={sunMapPoint.y} r="4" className="sun-anchor" />
          <text x={sunMapPoint.x + 10} y={sunMapPoint.y + 18} className="map-label muted">
            太阳盘面锚点
          </text>
          <line
            x1={observerMapPoint.x}
            y1={observerMapPoint.y}
            x2={viewDirectionEnd.x}
            y2={viewDirectionEnd.y}
            className="view-arrow"
            markerEnd="url(#arrowHead)"
          />
          <circle
            cx={observerMapPoint.x}
            cy={observerMapPoint.y}
            r="10"
            className="observer-point-halo"
          />
          <circle
            cx={observerMapPoint.x}
            cy={observerMapPoint.y}
            r="5"
            className="observer-point"
          />
        </svg>
        <div className="map-scale-note">外圈半径：20,000 秒差距</div>
      </div>

      <div className="observer-controls">
        <div className="observer-readout">
          <div>
            <span>横向坐标</span>
            <strong>{formatParsec(positionParsec.x)} 秒差距</strong>
          </div>
          <div>
            <span>纵向坐标</span>
            <strong>{formatParsec(positionParsec.y)} 秒差距</strong>
          </div>
          <div>
            <span>垂直坐标</span>
            <strong>{formatParsec(positionParsec.z)} 秒差距</strong>
          </div>
          <div>
            <span>银河中心距离</span>
            <strong>{formatParsec(radiusParsec)} 秒差距</strong>
          </div>
        </div>

        <label className="range-control">
          <span className="range-heading">
            <span>连续银河中心距离</span>
            <output>{formatParsec(radiusParsec)} 秒差距</output>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.00001"
            value={sliderFromRadius(radiusParsec)}
            onChange={(event) => {
              const nextRadius = radiusFromSlider(Number(event.target.value));
              onPositionChange(
                updateRadiusPreservingAzimuth(
                  positionParsec,
                  nextRadius,
                  positionAzimuthDegrees,
                ),
              );
            }}
            aria-label="连续银河中心距离，单位为秒差距"
          />
          <span className="range-extents">
            <span>100 秒差距</span>
            <span>20,000 秒差距</span>
          </span>
        </label>

        <label className="range-control compact">
          <span className="range-heading">
            <span>观察方向方位角</span>
            <output>{Math.round(viewAzimuthDegrees)}°</output>
          </span>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={viewAzimuthDegrees}
            onChange={(event) => onViewAzimuthChange(Number(event.target.value))}
            aria-label="观察方向方位角，单位为度"
          />
        </label>

        <div className="angle-separation">
          <div>
            <span>银河方位</span>
            <strong>{positionAzimuthDegrees.toFixed(2)}°</strong>
            <p>决定观察者站在银河中心的哪一侧。</p>
          </div>
          <div>
            <span>观察方向</span>
            <strong>{viewAzimuthDegrees.toFixed(0)}°</strong>
            <p>只决定观察者朝哪里看，不改变站立位置。</p>
          </div>
        </div>

        <p className="control-footnote">
          距离滑杆采用连续对数刻度：靠近中心时控制更细，但底层坐标始终是连续浮点数。拖动滑杆只改变坐标，不会改变星点数、辉光、银河带宽度或曝光。
          太阳标记只是垂直坐标为 0 的地图锚点，不代表太阳的完整三维位置、速度或不确定性。
        </p>
      </div>
    </div>
  );
}

export function ObserverCoordinateLab() {
  const [positionParsec, setPositionParsec] = useState<Vector3>({
    x: SOLAR_X_PARSEC,
    y: 0,
    z: 0,
  });
  const [viewAzimuthDegrees, setViewAzimuthDegrees] = useState(0);

  return (
    <ObserverCoordinatePanel
      positionParsec={positionParsec}
      onPositionChange={setPositionParsec}
      viewAzimuthDegrees={viewAzimuthDegrees}
      onViewAzimuthChange={setViewAzimuthDegrees}
      truthLabel="只验证连续坐标"
    />
  );
}
