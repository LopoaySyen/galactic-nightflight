"use client";
import { useObservationLanguage, ObservationLanguageProvider } from './observation-language';


import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  galactocentricAzimuthDegrees,
  galactocentricRadiusParsec,
  normalizeDegrees,
  updateFromPlanarPoint,
  updateRadiusPreservingAzimuth,
} from "@/lib/physics/coordinates";
import { fluxRatioFromMagnitudeDifference } from "@/lib/physics/photometry";
import {
  circularVelocityAtPosition,
  integratePhaseSpaceLeapfrog,
  type PhaseSpaceState,
} from "@/lib/physics/kinematics";
import type { Vector3 } from "@/lib/physics/vector";
import { numericalBenchmarkEmitters } from "@/lib/rendering/benchmark-catalog";
import { projectNumericalBenchmark } from "@/lib/rendering/benchmark-renderer";
import type { ObservationMode, RenderScope, ViewCamera } from "@/lib/rendering/contracts";
import {
  projectGalacticAllSkyPixelsToView,
  type GalaxyColourGrade,
} from "@/lib/rendering/galaxy-radiance";
import {
  projectPreparedGalaxyPointSources,
} from "@/lib/rendering/galaxy-star-renderer";
import {
  cataloguedExtragalacticSources,
  projectPreparedExtragalacticSources,
  statisticalBackgroundGalaxies,
} from "@/lib/rendering/extragalactic-catalog";
import {
  deepSkyImageSources,
  projectDeepSkyImageSources,
} from "@/lib/rendering/deep-sky-image-catalog";
import { modelPopulationEmitters } from "@/lib/rendering/model-star-catalog";
import { parseObservedBrightStarCatalog } from "@/lib/rendering/observed-star-catalog";
import { parseGaiaBrightStarCatalog } from "@/lib/rendering/gaia-bright-star-catalog";
import { includeNearbyStars, nearbyStars } from "@/lib/rendering/nearby-star-catalog";
import {
  altitudeFromSkyDirection,
  applyAtmosphereToViewPixels,
  atmosphericExtinctionMagnitude,
  daylightVisibilityPenaltyMagnitude,
  type AtmospherePreset,
} from "@/lib/rendering/planet-atmosphere";
import { projectDirectionPerspective } from "@/lib/rendering/projection";
import { productionRenderBlockers } from "@/lib/rendering/production-gate";
import {
  projectPlanetTerrainPixels,
  type GroundTextureRaster,
} from "@/lib/rendering/terrain-projection";

import { localZenith, localToGalactic } from "@/lib/rendering/local-frame";
import { createTerrainGpuRenderer, type TerrainGpuRenderer } from "@/lib/rendering/terrain-gpu";
import { createStarGpuRenderer, type StarGpuRenderer } from "@/lib/rendering/star-gpu";
import { stellarScintillation, starScintillationPhase } from "@/lib/rendering/stellar-scintillation";
import { createSkyBackgroundGpuRenderer, type SkyBackgroundGpuRenderer } from "@/lib/rendering/sky-background-gpu";
import { resolveQuickView } from "@/lib/rendering/quick-view";
import { useSkyComputation } from "./use-sky-computation";
import { blendDeepSkyPhoto } from "@/lib/rendering/deep-sky-composite";
import { StarDetail } from "./star-detail";
import { DeepSkyDetail } from "./deep-sky-detail";
import { SkySearch } from "./sky-search";
import { buildSkySearchIndex, type SkySearchEntry } from "@/lib/rendering/sky-search";
import { deepSkyTargetsById, pickDeepSkyTarget, isSkyPointObscured, type DeepSkyTarget, type DeepSkyHitArea } from "@/lib/rendering/sky-object-catalog";
import { createSkyPointerController, type CompletedSkyGesture } from "@/lib/rendering/sky-pointer";
import { drawObservedStarLabels, pickObservedStar, starName } from "@/lib/rendering/observed-star-interaction";
import { pointSourcePositionAtTime } from "@/lib/physics/kinematics";

import {observerPresets,cameraFacingGalacticCentre} from "@/lib/rendering/observer-presets";
import {observationTutorialSteps,shouldShowObservationTutorial,rememberObservationTutorial} from "@/lib/rendering/observation-tutorial";
import {ObservationTutorial} from "./observation-tutorial";
import {ObservationMusic} from "./observation-music";

const MINIMUM_RADIUS_PARSEC = 100;
const MAXIMUM_RADIUS_PARSEC = 20_000;
const SOLAR_X_PARSEC = -8_277;
const MAP_WIDTH = 300;
const MAP_HEIGHT = 230;
const MAP_CENTRE_X = MAP_WIDTH / 2;
const MAP_CENTRE_Y = MAP_HEIGHT / 2;
const MAP_RADIUS = 94;
const INITIAL_OBSERVER_POSITION = { x: SOLAR_X_PARSEC, y: 0, z: 0 } as const;
const MAXIMUM_SIMULATION_TIME_YEARS = 1_000_000;

type PanelName = "view" | "location" | "physics" | null;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function directionFromLongitudeLatitude(
  longitudeDegrees: number,
  latitudeDegrees: number,
): Vector3 {
  const longitude = degreesToRadians(longitudeDegrees);
  const latitude = degreesToRadians(latitudeDegrees);
  const cosineLatitude = Math.cos(latitude);
  return {
    x: cosineLatitude * Math.cos(longitude),
    y: cosineLatitude * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

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

function mapPoint(positionParsec: Vector3) {
  return {
    x: MAP_CENTRE_X + (positionParsec.x / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS,
    y: MAP_CENTRE_Y - (positionParsec.y / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS,
  };
}

function formatParsec(value: number, locale = "zh-CN"): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) < 1_000 ? 1 : 0,
  }).format(value);
}

function linearChannelToDisplay(channel: number): number {
  return Math.round(255 * clamp(channel ** (1 / 2.2), 0, 1));
}

function formatTimeYears(value: number, locale = "zh-CN"): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(value) < 100 ? 1 : 0 }).format(Math.abs(value))} 年`;
}

function observationModeLabel(mode: ObservationMode): string {
  if (mode === "camera") return "可见光相机";
  if (mode === "near-infrared") return "近红外相机";
  if (mode === "dark-adapted") return "暗适应裸眼";
  return "普通裸眼";
}

function observationModeDescription(mode: ObservationMode): string {
  if (mode === "camera") return "相机预览保留比裸眼更多的暗弱光和色彩；显示曝光由你控制，不随空间位置改变。当前是外观近似，尚未标定为真实相机的光电子读数。";
  if (mode === "near-infrared") return "近红外表示约 700–1100 纳米的感光波段，对尘埃更不敏感；画面采用暖色伪彩，不代表肉眼颜色。纳米是十亿分之一米。";
  if (mode === "dark-adapted") return "暗适应让更暗的恒星可见，并降低暗弱星光的色彩饱和度，模拟视杆细胞主导的暗视觉。";
  return "裸眼模式采用较低的暗星阈值和较完整的亮星色彩，模拟尚未充分暗适应的视觉。";
}

export function PlanetariumScene({ initialLanguage = 'zh' }: { initialLanguage?: 'zh' | 'en' }) {
  return <ObservationLanguageProvider initialLanguage={initialLanguage}><PlanetariumView/></ObservationLanguageProvider>;
}

function PlanetariumView() {
  const { language, locale, t, toggleLanguage } = useObservationLanguage();
  const [scope, setScope] = useState<RenderScope>("galaxy-prediction");
  const [observationMode, setObservationMode] = useState<ObservationMode>("camera");
  const [observedBrightStars, setObservedBrightStars] = useState<ReturnType<typeof parseObservedBrightStarCatalog>>([]);
  const [gaiaBrightStars, setGaiaBrightStars] = useState<ReturnType<typeof parseGaiaBrightStarCatalog>>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "failed">("loading");
  const [gaiaCatalogueState, setGaiaCatalogueState] = useState<"loading" | "ready" | "failed">("loading");
  const [viewAngles, setCamera] = useState<ViewCamera>({
    azimuthDegrees: 18,
    elevationDegrees: -4,
    horizontalFieldOfViewDegrees: 82,
  });
  const [observerPositionParsec, setObserverPositionParsec] = useState<Vector3>(INITIAL_OBSERVER_POSITION);
  const [observerVelocityKilometresPerSecond, setObserverVelocityKilometresPerSecond] = useState<Vector3>(() => circularVelocityAtPosition(INITIAL_OBSERVER_POSITION));
  const [simulationTimeYears, setSimulationTimeYears] = useState(0);
  const [timeSpeedPower, setTimeSpeedPower] = useState(3);
  const [timeDirection, setTimeDirection] = useState<1 | -1>(1);
  const [isTimePlaying, setIsTimePlaying] = useState(false);
  const [observerFollowsDynamics, setObserverFollowsDynamics] = useState(true);
  const [atmospherePreset, setAtmospherePreset] = useState<AtmospherePreset>("earth-clear");
  const [scintillationEnabled, setScintillationEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const scintillationTimeRef = useRef(0);
  const scintillationActive = scintillationEnabled && !reducedMotion && atmospherePreset !== "space" && scope === "galaxy-prediction";
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const [planetInclinationDegrees, setPlanetInclinationDegrees] = useState(22);
  const [displayExposureStops, setDisplayExposureStops] = useState(0.5);
  const [navigationNotice, setNavigationNotice] = useState("");
  const [centreLocked,setCentreLocked]=useState(false);
  const [tutorialStep,setTutorialStep]=useState<number|null>(null);
  const [minimalInterface, setMinimalInterface] = useState(false);
  const atmosphereZenith = useMemo(() => localZenith(planetInclinationDegrees), [planetInclinationDegrees]);
  const camera = useMemo<ViewCamera>(() => ({ ...(centreLocked?cameraFacingGalacticCentre(observerPositionParsec,viewAngles):viewAngles),
    upDirection: atmospherePreset === "space" ? undefined : atmosphereZenith,
  }), [viewAngles, centreLocked, observerPositionParsec, atmospherePreset, atmosphereZenith]);
  useEffect(()=>{
    if(!centreLocked||atmospherePreset==="space")return;
    const distance=Math.hypot(observerPositionParsec.x,observerPositionParsec.y,observerPositionParsec.z);
    if(distance<1e-9)return;
    const altitude=Math.asin(clamp((-observerPositionParsec.x*atmosphereZenith.x-observerPositionParsec.y*atmosphereZenith.y-observerPositionParsec.z*atmosphereZenith.z)/distance,-1,1))*180/Math.PI;
    if(altitude<8){const frame=requestAnimationFrame(()=>{setAtmospherePreset("space");setNavigationNotice("中心锁定的方向被地平线遮挡或紧贴地面，已切换为无大气视图，继续跟随银河中心。");});return()=>cancelAnimationFrame(frame);}
  },[centreLocked,observerPositionParsec,atmosphereZenith,atmospherePreset]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{try{if(shouldShowObservationTutorial(window.localStorage))setTutorialStep(0);}catch{setTutorialStep(0);}});return()=>cancelAnimationFrame(frame);},[]);
  const [sunAltitudeDegrees, setSunAltitudeDegrees] = useState(-18);
  const [sunAzimuthDegrees, setSunAzimuthDegrees] = useState(240);
  const [showExtragalactic, setShowExtragalactic] = useState(true);
  const [showDeepSkyImages, setShowDeepSkyImages] = useState(true);
  const [enhanceDeepSkyScale, setEnhanceDeepSkyScale] = useState(false);
  const [galaxyColourGrade, setGalaxyColourGrade] = useState<GalaxyColourGrade>("observational");
  const [activePanel, setActivePanel] = useState<PanelName>(null);
  const [showCoordinateGrid, setShowCoordinateGrid] = useState(false);
  const [showGalacticPlane, setShowGalacticPlane] = useState(false);
  const [showBenchmarkLabels, setShowBenchmarkLabels] = useState(false);
  const [isSkyDragging, setIsSkyDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyBackgroundRef = useRef<HTMLCanvasElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const starCanvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const starsGpuRef = useRef<StarGpuRenderer | null>(null);
  const backgroundGpuRef = useRef<SkyBackgroundGpuRenderer | null>(null);
  const uploadedSourcesRef = useRef<typeof preparedGalaxyPointSources>(undefined);
  const uploadedBackgroundRef = useRef<Uint8ClampedArray | null>(null);
  const backgroundProjectionKeyRef = useRef("");
  const latestDrawRef = useRef<() => void>(() => {});
  const [renderError, setRenderError] = useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [selectedDeepSkyId,setSelectedDeepSkyId]=useState<string|null>(null);
  const selectedDeepSky=selectedDeepSkyId?deepSkyTargetsById.get(selectedDeepSkyId):undefined;
  const searchButtonRef=useRef<HTMLButtonElement>(null);
  const deepSkyHitAreasRef=useRef<DeepSkyHitArea[]>([]);
  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const radianceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deepSkyImagesRef = useRef<Map<string, { observational: HTMLCanvasElement; immersive: HTMLCanvasElement; mask: {width:number;height:number;pixels:Uint8ClampedArray} }>>(new Map());
  const terrainGpuRef = useRef<TerrainGpuRenderer | null>(null);
  const planetPanoramaRasterRef = useRef<GroundTextureRaster | null>(null);
  const planetGroundImageRef = useRef<HTMLImageElement | null>(null);
  const planetTerrainImageRef = useRef<HTMLImageElement | null>(null);
  const planetGroundTextureRef = useRef<GroundTextureRaster | null>(null);
  const groundProjectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const groundProjectionCacheKeyRef = useRef("");
  const drawRequestRef = useRef<number | null>(null);
  const [deepSkyAssetVersion, setDeepSkyAssetVersion] = useState(0);
  const [planetTerrainAssetVersion, setPlanetTerrainAssetVersion] = useState(0);
  const radianceCacheRef = useRef<{
    key: string;
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const skyPointerRef = useRef(createSkyPointerController());
  const completedSkyGestureRef = useRef<CompletedSkyGesture | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeRef = useRef<number | null>(null);
  const accumulatedElapsedYearsRef = useRef(0);
  const simulationTimeRef = useRef(0);
  const observerDynamicsRef = useRef<PhaseSpaceState>({
    positionParsec: INITIAL_OBSERVER_POSITION,
    velocityKilometresPerSecond: circularVelocityAtPosition(INITIAL_OBSERVER_POSITION),
  });
  const observerEpochRef = useRef<PhaseSpaceState>({
    positionParsec: INITIAL_OBSERVER_POSITION,
    velocityKilometresPerSecond: circularVelocityAtPosition(INITIAL_OBSERVER_POSITION),
  });
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [isPositionScrubbing, setIsPositionScrubbing] = useState(false);
  const observedStars = useMemo(() => includeNearbyStars([...observedBrightStars, ...gaiaBrightStars]), [observedBrightStars, gaiaBrightStars]);
  const galaxyPointSources = useMemo(
    () => [...observedStars, ...modelPopulationEmitters],
    [observedStars],
  );
  const { result: skyComputation, points: skyPoints, state: computeState } = useSkyComputation(
    galaxyPointSources, observerPositionParsec, simulationTimeYears, observationMode,
    galaxyColourGrade, isMapDragging || isPositionScrubbing || isTimePlaying,
  );
  const preparedGalaxyPointSources = skyPoints?.sources;
  const preparedExtragalacticSources = skyPoints?.galaxies;
  const observedStarsById = useMemo(() => new Map(observedStars.map(source => [source.id, source])), [observedStars]);
  const searchIndex=useMemo(()=>buildSkySearchIndex(observedStars),[observedStars]);
  const selectedStar = selectedStarId ? observedStarsById.get(selectedStarId) : undefined;
  const namedPreparedStars = useMemo(() => (preparedGalaxyPointSources ?? []).filter(source =>
    source.role === "observed-bright-star" && source.displayName), [preparedGalaxyPointSources]);
  const releaseSkyPointerCapture = useCallback((pointerId:number|null) => {
    if(pointerId===null)return;
    const canvas=canvasRef.current;
    try { if(canvas?.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId); }
    catch { /* The browser may already have released the pointer. */ }
  },[]);
  const finishSkyPointer = useCallback((event:Pick<PointerEvent,"pointerId"|"clientX"|"clientY">) => {
    const gesture=skyPointerRef.current.end(event);
    if(gesture)completedSkyGestureRef.current=gesture;
    setIsSkyDragging(false);
    releaseSkyPointerCapture(event.pointerId);
  },[releaseSkyPointerCapture]);
  const cancelSkyPointer = useCallback(() => {
    const pointerId=skyPointerRef.current.activePointerId;
    skyPointerRef.current.cancel();completedSkyGestureRef.current=null;
    setIsSkyDragging(false);releaseSkyPointerCapture(pointerId);
  },[releaseSkyPointerCapture]);
  useEffect(() => {
    const onVisibility=()=>{if(document.hidden)cancelSkyPointer();};
    window.addEventListener("pointerup",finishSkyPointer,true);
    window.addEventListener("pointercancel",cancelSkyPointer,true);
    window.addEventListener("blur",cancelSkyPointer);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.removeEventListener("pointerup",finishSkyPointer,true);
      window.removeEventListener("pointercancel",cancelSkyPointer,true);window.removeEventListener("blur",cancelSkyPointer);
      document.removeEventListener("visibilitychange",onVisibility);};
  },[finishSkyPointer,cancelSkyPointer]);
  const sunDirection = useMemo(
    () => localToGalactic(directionFromLongitudeLatitude(sunAzimuthDegrees, sunAltitudeDegrees), planetInclinationDegrees),
    [sunAltitudeDegrees, sunAzimuthDegrees, planetInclinationDegrees],
  );

  useEffect(() => {
    if (starCanvasRef.current) starsGpuRef.current = createStarGpuRenderer(starCanvasRef.current);
    if (skyBackgroundRef.current) backgroundGpuRef.current = createSkyBackgroundGpuRenderer(skyBackgroundRef.current);
    return () => { starsGpuRef.current?.dispose(); backgroundGpuRef.current?.dispose();
      starsGpuRef.current = null; backgroundGpuRef.current = null; uploadedSourcesRef.current = undefined; uploadedBackgroundRef.current = null; };
  }, []);

  const relocateObserver = useCallback((positionParsec: Vector3) => {
    const velocityKilometresPerSecond = circularVelocityAtPosition(positionParsec);
    observerDynamicsRef.current = { positionParsec, velocityKilometresPerSecond };
    observerEpochRef.current = { positionParsec, velocityKilometresPerSecond };
    setObserverPositionParsec(positionParsec);
    setObserverVelocityKilometresPerSecond(velocityKilometresPerSecond);
    simulationTimeRef.current = 0;
    setSimulationTimeYears(0);
    setIsTimePlaying(false);
  }, []);

  const resetSimulationTime = useCallback(() => {
    observerDynamicsRef.current = observerEpochRef.current;
    setObserverPositionParsec(observerEpochRef.current.positionParsec);
    setObserverVelocityKilometresPerSecond(observerEpochRef.current.velocityKilometresPerSecond);
    simulationTimeRef.current = 0;
    setSimulationTimeYears(0);
    setIsTimePlaying(false);
  }, []);

  useEffect(() => {
    if (!isTimePlaying) {
      animationTimeRef.current = null;
      accumulatedElapsedYearsRef.current = 0;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      return;
    }
    let previousUiUpdateMilliseconds = 0;
    const animate = (nowMilliseconds: number) => {
      const previousMilliseconds = animationTimeRef.current ?? nowMilliseconds;
      animationTimeRef.current = nowMilliseconds;
      const elapsedRealSeconds = Math.min(0.1, (nowMilliseconds - previousMilliseconds) / 1_000);
      const simulatedElapsedYears = elapsedRealSeconds * 10 ** timeSpeedPower * timeDirection;
      accumulatedElapsedYearsRef.current += simulatedElapsedYears;
      if (nowMilliseconds - previousUiUpdateMilliseconds >= 32 && simulatedElapsedYears !== 0) {
        previousUiUpdateMilliseconds = nowMilliseconds;
        const accumulatedElapsedYears = accumulatedElapsedYearsRef.current;
        accumulatedElapsedYearsRef.current = 0;
        const currentTime = simulationTimeRef.current;
        const nextTime = clamp(currentTime + accumulatedElapsedYears, -MAXIMUM_SIMULATION_TIME_YEARS, MAXIMUM_SIMULATION_TIME_YEARS);
        const appliedElapsedYears = nextTime - currentTime;
        simulationTimeRef.current = nextTime;
        if (observerFollowsDynamics && appliedElapsedYears !== 0) {
          const nextObserverState = integratePhaseSpaceLeapfrog(observerDynamicsRef.current, appliedElapsedYears);
          observerDynamicsRef.current = nextObserverState;
          setObserverPositionParsec(nextObserverState.positionParsec);
          setObserverVelocityKilometresPerSecond(nextObserverState.velocityKilometresPerSecond);
        }
        setSimulationTimeYears(nextTime);
        if (Math.abs(nextTime) >= MAXIMUM_SIMULATION_TIME_YEARS) setIsTimePlaying(false);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      animationTimeRef.current = null;
    };
  }, [isTimePlaying, observerFollowsDynamics, timeDirection, timeSpeedPower]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/yale-bright-stars.csv")
      .then((response) => {
        if (!response.ok) throw new Error("Bright-star catalogue could not be loaded.");
        return response.text();
      })
      .then((catalogue) => {
        if (cancelled) return;
        setObservedBrightStars(parseObservedBrightStarCatalog(catalogue));
        setCatalogueState("ready");
      })
      .catch(() => {
        if (!cancelled) setCatalogueState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/gaia-dr3-bright-6d.bin")
      .then((response) => {
        if (!response.ok) throw new Error("Gaia catalogue could not be loaded.");
        return response.arrayBuffer();
      })
      .then((catalogue) => {
        if (cancelled) return;
        setGaiaBrightStars(parseGaiaBrightStarCatalog(catalogue));
        setGaiaCatalogueState("ready");
      })
      .catch(() => {
        if (!cancelled) setGaiaCatalogueState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const source of deepSkyImageSources) {
      if (deepSkyImagesRef.current.has(source.id)) continue;
      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => {
        if (cancelled) return;
        const maximumDimension = 1_536;
        const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const featheredImage = document.createElement("canvas");
        featheredImage.width = Math.max(1, Math.round(image.naturalWidth * scale));
        featheredImage.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const imageContext = featheredImage.getContext("2d", {willReadFrequently:true});
        if (!imageContext) return;
        imageContext.drawImage(image, 0, 0, featheredImage.width, featheredImage.height);
        const imageData = imageContext.getImageData(0, 0, featheredImage.width, featheredImage.height);
        const originalPixels = new Uint8ClampedArray(imageData.data);
        imageData.data.set(blendDeepSkyPhoto(originalPixels, featheredImage.width, featheredImage.height, "observational"));
        imageContext.putImageData(imageData,0,0);
        const immersiveImage = document.createElement("canvas");
        immersiveImage.width=featheredImage.width; immersiveImage.height=featheredImage.height;
        const immersiveContext=immersiveImage.getContext("2d");
        if (!immersiveContext) return;
        imageData.data.set(blendDeepSkyPhoto(originalPixels, featheredImage.width, featheredImage.height, "immersive"));
        immersiveContext.putImageData(imageData,0,0);
        const maskCanvas=document.createElement("canvas");maskCanvas.width=128;maskCanvas.height=Math.max(1,Math.round(128*featheredImage.height/featheredImage.width));
        const maskContext=maskCanvas.getContext("2d");if(!maskContext)return;
        maskContext.drawImage(featheredImage,0,0,maskCanvas.width,maskCanvas.height);
        const mask={width:maskCanvas.width,height:maskCanvas.height,pixels:maskContext.getImageData(0,0,maskCanvas.width,maskCanvas.height).data};
        deepSkyImagesRef.current.set(source.id, {observational:featheredImage, immersive:immersiveImage,mask});
        setDeepSkyAssetVersion((version) => version + 1);
      };
      image.src = source.imagePath;
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const updateTerrainRenderer = () => {
      if (!planetTerrainImageRef.current || !planetGroundImageRef.current) return;
      terrainGpuRef.current?.dispose();
      terrainGpuRef.current = createTerrainGpuRenderer(planetTerrainImageRef.current, planetGroundImageRef.current, terrainCanvasRef.current ?? undefined);
    };
    const panorama = new window.Image();
    panorama.decoding = "async";
    panorama.onload = () => {
      if (cancelled) return;
      planetTerrainImageRef.current = panorama;
      const raster = document.createElement("canvas");
      raster.width = panorama.naturalWidth; raster.height = panorama.naturalHeight;
      const rasterContext = raster.getContext("2d", { willReadFrequently: true });
      if (rasterContext) {
        rasterContext.drawImage(panorama, 0, 0);
        planetPanoramaRasterRef.current = { width: raster.width, height: raster.height,
          pixels: rasterContext.getImageData(0, 0, raster.width, raster.height).data };
      }
      updateTerrainRenderer();
      setPlanetTerrainAssetVersion((version) => version + 1);
    };
    panorama.src = "/terrain/planet-terrain-panorama-v2.webp";

    const groundTexture = new window.Image();
    groundTexture.decoding = "async";
    groundTexture.onload = () => {
      if (cancelled) return;
      planetGroundImageRef.current = groundTexture;
      updateTerrainRenderer();
      const textureCanvas = document.createElement("canvas");
      textureCanvas.width = groundTexture.naturalWidth;
      textureCanvas.height = groundTexture.naturalHeight;
      const textureContext = textureCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (!textureContext) return;
      textureContext.drawImage(groundTexture, 0, 0);
      const texturePixels = textureContext.getImageData(
        0,
        0,
        textureCanvas.width,
        textureCanvas.height,
      );
      planetGroundTextureRef.current = {
        pixels: texturePixels.data,
        width: textureCanvas.width,
        height: textureCanvas.height,
      };
      groundProjectionCacheKeyRef.current = "";
      setPlanetTerrainAssetVersion((version) => version + 1);
    };
    groundTexture.src = "/terrain/basalt-ground-texture-v1.webp";
    return () => {
      cancelled = true;
      terrainGpuRef.current?.dispose();
      terrainGpuRef.current = null;
    };
  }, []);

  const radiusParsec = galactocentricRadiusParsec(observerPositionParsec);
  const timeSpeedYearsPerSecond = 10 ** timeSpeedPower;
  const observerSpeedKilometresPerSecond = Math.hypot(
    observerVelocityKilometresPerSecond.x,
    observerVelocityKilometresPerSecond.y,
    observerVelocityKilometresPerSecond.z,
  );
  const positionAzimuthDegrees = galactocentricAzimuthDegrees(
    observerPositionParsec,
  );
  const observerMapPoint = mapPoint(observerPositionParsec);
  const sunMapPoint = mapPoint({ x: SOLAR_X_PARSEC, y: 0, z: 0 });
  const observedCatalogueCount = observedStars.length;
  const viewArrowEnd = useMemo(() => {
    const radians = degreesToRadians(camera.azimuthDegrees);
    return {
      x: observerMapPoint.x + Math.cos(radians) * 28,
      y: observerMapPoint.y - Math.sin(radians) * 28,
    };
  }, [camera.azimuthDegrees, observerMapPoint.x, observerMapPoint.y]);

  const drawCurve = useCallback(
    (
      context: CanvasRenderingContext2D,
      directions: readonly Vector3[],
      width: number,
      height: number,
      colour: string,
      lineWidth: number,
    ) => {
      context.beginPath();
      let drawing = false;
      let previousX = 0;
      let previousY = 0;
      for (const direction of directions) {
        const projected = projectDirectionPerspective(
          direction,
          camera,
          width,
          height,
        );
        const discontinuity =
          drawing &&
          Math.hypot(projected.canvasX - previousX, projected.canvasY - previousY) >
            width * 0.18;
        if (!projected.visible || discontinuity) {
          drawing = false;
          continue;
        }
        if (!drawing) context.moveTo(projected.canvasX, projected.canvasY);
        else context.lineTo(projected.canvasX, projected.canvasY);
        drawing = true;
        previousX = projected.canvasX;
        previousY = projected.canvasY;
      }
      context.strokeStyle = colour;
      context.lineWidth = lineWidth;
      context.stroke();
    },
    [camera],
  );

  const drawSky = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * pixelRatio));
    const height = Math.max(1, Math.round(bounds.height * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1,0,0,1,0,0);
    context.globalCompositeOperation = "source-over"; context.globalAlpha = 1; context.filter = "none";
    context.clearRect(0, 0, width, height);
    deepSkyHitAreasRef.current=[];
    const photoCanvas=photoCanvasRef.current;
    if(photoCanvas && (photoCanvas.width!==width || photoCanvas.height!==height)){photoCanvas.width=width;photoCanvas.height=height;}
    const photoContext=photoCanvas?.getContext("2d");
    if(photoContext){
      photoContext.setTransform(1,0,0,1,0,0);photoContext.globalAlpha=1;
      photoContext.clearRect(0,0,width,height);
    }

    const backgroundGpu = backgroundGpuRef.current;
    if (skyComputation && backgroundGpu && uploadedBackgroundRef.current !== skyComputation.pixels) {
      backgroundGpu.setSky(skyComputation.pixels, skyComputation.width, skyComputation.height);
      uploadedBackgroundRef.current = skyComputation.pixels;
    }
    const backgroundWidth = Math.min(width,1600);
    const backgroundHeight = Math.max(1,Math.round(backgroundWidth*height/width));
    const backgroundOnGpu = scope === "galaxy-prediction" && !!backgroundGpu?.render(camera, backgroundWidth, backgroundHeight,
      atmosphereZenith, sunDirection, sunAltitudeDegrees, atmospherePreset, observationMode, displayExposureStops);
    if (skyBackgroundRef.current) skyBackgroundRef.current.style.visibility = backgroundOnGpu ? "visible" : "hidden";
    const starsGpu = starsGpuRef.current;
    if (preparedGalaxyPointSources && starsGpu && uploadedSourcesRef.current !== preparedGalaxyPointSources) {
      starsGpu.setSources(preparedGalaxyPointSources, skyPoints?.position ?? INITIAL_OBSERVER_POSITION);
      uploadedSourcesRef.current = preparedGalaxyPointSources;
    }
    const starsOnGpu = scope === "galaxy-prediction" && !!starsGpu?.render(camera,
      observerPositionParsec, simulationTimeYears, width, height, pixelRatio, atmosphereZenith, atmospherePreset,
      observationMode, displayExposureStops, sunAltitudeDegrees, scintillationTimeRef.current, scintillationActive);
    if (starCanvasRef.current) starCanvasRef.current.style.visibility = starsOnGpu ? "visible" : "hidden";

    if (scope === "galaxy-prediction" && !backgroundOnGpu) {
      const radianceWidth = isSkyDragging ? 240 : 480;
      const radianceHeight = Math.max(1, Math.round(radianceWidth * height / width));
      if (!radianceCanvasRef.current) radianceCanvasRef.current = document.createElement("canvas");
      const radianceCanvas = radianceCanvasRef.current;
      if (skyComputation) radianceCacheRef.current = { key: String(skyComputation.id),
        pixels: skyComputation.pixels, width: skyComputation.width, height: skyComputation.height };
      const projectionKey = [skyComputation?.id, skyComputation?.width, camera.azimuthDegrees, camera.elevationDegrees,
        camera.horizontalFieldOfViewDegrees, planetInclinationDegrees, atmospherePreset, observationMode,
        sunAltitudeDegrees, sunDirection.x, sunDirection.y, sunDirection.z, displayExposureStops, radianceWidth, radianceHeight].join("|");
      if (radianceCanvas.width !== radianceWidth || radianceCanvas.height !== radianceHeight) {
        radianceCanvas.width = radianceWidth; radianceCanvas.height = radianceHeight;
      }
      const radianceContext = radianceCanvas.getContext("2d");
      const cachedRadiance = radianceCacheRef.current;
      if (radianceContext && cachedRadiance && backgroundProjectionKeyRef.current !== projectionKey) {
        const imageData = radianceContext.createImageData(
          radianceWidth,
          radianceHeight,
        );
        const viewPixels = projectGalacticAllSkyPixelsToView(
            cachedRadiance.pixels,
            cachedRadiance.width,
            cachedRadiance.height,
            camera,
            radianceWidth,
            radianceHeight,
          );
        for (let offset = 0; offset < viewPixels.length; offset += 4) {
          for (let channel = 0; channel < 3; channel++) {
            const linear = (viewPixels[offset + channel] / 255) ** 2.2;
            viewPixels[offset + channel] = Math.round(255 * Math.min(1, linear * 2 ** displayExposureStops) ** (1 / 2.2));
          }
        }
        imageData.data.set(
          applyAtmosphereToViewPixels(
            viewPixels,
            camera,
            atmosphereZenith,
            sunDirection,
            sunAltitudeDegrees,
            atmospherePreset,
            observationMode,
            radianceWidth,
            radianceHeight,
          ),
        );
        radianceContext.putImageData(imageData, 0, 0);
        backgroundProjectionKeyRef.current = projectionKey;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(radianceCanvas, 0, 0, width, height);
    } else if (scope !== "galaxy-prediction") {
      const background = context.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );
      background.addColorStop(0, "#071218");
      background.addColorStop(1, "#010406");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }

    if (
      scope === "galaxy-prediction" &&
      showDeepSkyImages &&
      deepSkyAssetVersion > 0 && photoContext &&
      observationMode === "camera"
    ) {
      const projectedImages = projectDeepSkyImageSources(
        deepSkyImageSources,
        observerPositionParsec,
        camera,
        width,
        height,
      );
      for (const source of projectedImages) {
        if (source.objectClass === "galaxy" && !showExtragalactic) continue;
        const image = deepSkyImagesRef.current.get(source.id)?.[galaxyColourGrade];
        if (!image) continue;
        const altitudeDegrees = altitudeFromSkyDirection(source.skyDirection, atmosphereZenith);
        const atmosphereMagnitude = atmosphericExtinctionMagnitude(
          altitudeDegrees,
          atmospherePreset,
          observationMode,
        );
        if (!Number.isFinite(atmosphereMagnitude)) continue;
        const scaleMultiplier = enhanceDeepSkyScale ? source.enhancedScaleMultiplier : 1;
        const majorPixels = 2 * Math.hypot(source.imageRightCanvasX, source.imageRightCanvasY) * scaleMultiplier;
        const minorPixels = 2 * Math.hypot(source.imageDownCanvasX, source.imageDownCanvasY) * scaleMultiplier;
        if (majorPixels < 1 || minorPixels < 1) continue;
        const atmosphereTransmission = 10 **
          (-0.4 * (atmosphereMagnitude + daylightVisibilityPenaltyMagnitude(sunAltitudeDegrees, atmospherePreset)));
        const enlargementSurfaceBrightness = enhanceDeepSkyScale
          ? 1 / Math.sqrt(scaleMultiplier)
          : 1;
        photoContext.save();
        photoContext.transform(source.imageRightCanvasX*scaleMultiplier, source.imageRightCanvasY*scaleMultiplier,
          source.imageDownCanvasX*scaleMultiplier, source.imageDownCanvasY*scaleMultiplier, source.canvasX, source.canvasY);
        photoContext.globalCompositeOperation = "screen";
        photoContext.globalAlpha = Math.min(1, source.cameraOpacity * atmosphereTransmission * enlargementSurfaceBrightness
          * (1-Math.exp(-Math.pow(2,displayExposureStops))));
        photoContext.imageSmoothingEnabled = true;
        photoContext.imageSmoothingQuality = "high";
        photoContext.drawImage(image, -1, -1, 2, 2);
        if(photoContext.globalAlpha>.004)deepSkyHitAreasRef.current.push({id:source.id.replace(/-image$/,""),x:source.canvasX,y:source.canvasY,
          rightX:source.imageRightCanvasX*scaleMultiplier,rightY:source.imageRightCanvasY*scaleMultiplier,
          downX:source.imageDownCanvasX*scaleMultiplier,downY:source.imageDownCanvasY*scaleMultiplier,shape:"photo",mask:deepSkyImagesRef.current.get(source.id)?.mask});
        photoContext.restore();
        if (showBenchmarkLabels) {
          context.fillStyle = "rgba(224, 235, 238, 0.82)";
          context.font = `${10 * pixelRatio}px system-ui, sans-serif`;
          context.fillText(
            t(source.displayName),
            source.canvasX + majorPixels * 0.52,
            source.canvasY - minorPixels * 0.46,
          );
        }
      }
    }

    if (scope === "galaxy-prediction" && showExtragalactic) {
      const galaxies = projectPreparedExtragalacticSources(
        preparedExtragalacticSources ?? [],
        camera,
        width,
        height,
        observerPositionParsec,
      );
      const galaxyLimit = observationMode === "naked-eye"
        ? 6.2
        : observationMode === "dark-adapted"
          ? 7.1
          : observationMode === "near-infrared"
            ? 14
            : 15;
      context.globalCompositeOperation = "lighter";
      for (const galaxy of galaxies) {
        if (showDeepSkyImages && observationMode === "camera" && galaxy.id === "m31" && deepSkyImagesRef.current.has("m31-image")) continue;
        const altitudeDegrees = altitudeFromSkyDirection(galaxy.skyDirection, atmosphereZenith);
        const atmosphereMagnitude = atmosphericExtinctionMagnitude(
          altitudeDegrees,
          atmospherePreset,
          observationMode,
        );
        const observedMagnitude =
          galaxy.apparentVisualMagnitude +
          atmosphereMagnitude +
          daylightVisibilityPenaltyMagnitude(sunAltitudeDegrees, atmospherePreset);
        if (!Number.isFinite(observedMagnitude) || observedMagnitude > galaxyLimit) continue;
        const physicalMajorPixels = 2 * Math.hypot(galaxy.majorCanvasX, galaxy.majorCanvasY);
        const isCatalogued = galaxy.evidence === "catalogued-local-group";
        const majorPixels = Math.max(physicalMajorPixels, isCatalogued ? 2.2 * pixelRatio : 0.65 * pixelRatio);
        const axisScale = majorPixels / Math.max(1e-9, physicalMajorPixels);
        if(isCatalogued)deepSkyHitAreasRef.current.push({id:galaxy.id,x:galaxy.canvasX,y:galaxy.canvasY,
          rightX:galaxy.majorCanvasX*axisScale,rightY:galaxy.majorCanvasY*axisScale,
          downX:galaxy.minorCanvasX*axisScale,downY:galaxy.minorCanvasY*axisScale,shape:"ellipse"});
        const integratedSignal = clamp(
          1 - Math.exp(-(isCatalogued ? 12 : 5) * fluxRatioFromMagnitudeDifference(observedMagnitude)),
          0.02,
          0.9,
        );
        const saturation = observationMode === "dark-adapted" ? 0.08 : observationMode === "naked-eye" ? 0.25 : galaxyColourGrade === "observational" ? 0.55 : 1;
        const colourResponse = (rgb:readonly number[]) => {
          const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
          return rgb.map(channel=>Math.round(255*clamp(luminance+(channel-luminance)*saturation,0,1)));
        };
        const [red, green, blue] = colourResponse(galaxy.colour);
        context.save();
        context.transform(galaxy.majorCanvasX*axisScale, galaxy.majorCanvasY*axisScale,
          galaxy.minorCanvasX*axisScale, galaxy.minorCanvasY*axisScale, galaxy.canvasX, galaxy.canvasY);
        const halo = context.createRadialGradient(0, 0, 0, 0, 0, 1);
        const coreColour = colourResponse(galaxy.morphology === "elliptical" ? [1, 213/255, 166/255] : [1, 225/255, 188/255]);
        halo.addColorStop(0, `rgba(${coreColour[0]}, ${coreColour[1]}, ${coreColour[2]}, ${0.7 * integratedSignal})`);
        halo.addColorStop(0.16, `rgba(${red}, ${green}, ${blue}, ${0.48 * integratedSignal})`);
        halo.addColorStop(galaxy.morphology === "irregular" ? 0.58 : 0.76, `rgba(${red}, ${green}, ${blue}, ${0.15 * integratedSignal})`);
        halo.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        context.fillStyle = halo;
        context.beginPath();
        context.arc(0, 0, 1, 0, Math.PI * 2);
        context.fill();
        if (isCatalogued && galaxy.morphology === "spiral" && majorPixels > 15 * pixelRatio) {
          context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${0.12 * integratedSignal})`;
          context.lineWidth = Math.max(0.015, 0.8 / majorPixels);
          for (const handedness of [-1, 1]) {
            context.beginPath();
            for (let step = 0; step <= 30; step += 1) {
              const theta = handedness * (0.45 + step * 0.19);
              const radius = 0.08 + step * 0.025;
              const x = Math.cos(theta) * radius;
              const y = Math.sin(theta) * radius;
              if (step === 0) context.moveTo(x, y);
              else context.lineTo(x, y);
            }
            context.stroke();
          }
        }
        context.restore();
        if (showBenchmarkLabels && isCatalogued && galaxy.displayName) {
          context.globalCompositeOperation = "source-over";
          context.fillStyle = "rgba(220, 230, 231, 0.72)";
          context.font = `${9 * pixelRatio}px system-ui, sans-serif`;
          context.fillText(t(galaxy.displayName), galaxy.canvasX + majorPixels * 0.55 + 5 * pixelRatio, galaxy.canvasY - 4 * pixelRatio);
          context.globalCompositeOperation = "lighter";
        }
      }
      context.globalCompositeOperation = "source-over";
    }

    if (showCoordinateGrid) {
      for (let longitude = -180; longitude < 180; longitude += 30) {
        const directions = [];
        for (let latitude = -88; latitude <= 88; latitude += 2) {
          directions.push(directionFromLongitudeLatitude(longitude, latitude));
        }
        drawCurve(context, directions, width, height, "rgba(116, 157, 171, 0.16)", pixelRatio * 0.7);
      }
      for (let latitude = -75; latitude <= 75; latitude += 15) {
        const directions = [];
        for (let longitude = -180; longitude <= 180; longitude += 2) {
          directions.push(directionFromLongitudeLatitude(longitude, latitude));
        }
        drawCurve(context, directions, width, height, "rgba(116, 157, 171, 0.13)", pixelRatio * 0.7);
      }
    }

    if (showGalacticPlane) {
      const planeDirections = [];
      for (let longitude = -180; longitude <= 180; longitude += 1) {
        planeDirections.push(directionFromLongitudeLatitude(longitude, 0));
      }
      drawCurve(context, planeDirections, width, height, "rgba(235, 172, 93, 0.5)", pixelRatio);
    }

    const projectedSources = starsOnGpu ? [] :
      scope === "galaxy-prediction"
        ? projectPreparedGalaxyPointSources(
            preparedGalaxyPointSources ?? [],
            camera,
            width,
            height,
            observerPositionParsec,
            simulationTimeYears,
          )
        : projectNumericalBenchmark(
            numericalBenchmarkEmitters,
            observerPositionParsec,
            camera,
            width,
            height,
          );
    const daylightPenalty = daylightVisibilityPenaltyMagnitude(
      sunAltitudeDegrees,
      atmospherePreset,
    );
    const limitingMagnitude =
      scope === "numerical-benchmark"
        ? 13.5
        : observationMode === "camera"
          ? 12.4
          : observationMode === "near-infrared"
            ? 12
          : observationMode === "dark-adapted"
            ? 7.1
            : 6.2;
    const pointResponseGain =
      observationMode === "camera"
        ? 420
        : observationMode === "near-infrared"
          ? 360
        : observationMode === "dark-adapted"
          ? 155
          : 105;
    context.globalCompositeOperation = "lighter";
    const visibleSources: Array<{
      source: (typeof projectedSources)[number];
      index: number;
      observedMagnitude: number;
      detectorSignal: number;
      scintillation: number;
      red: number;
      green: number;
      blue: number;
    }> = [];
    projectedSources.forEach((source, index) => {
      const altitudeDegrees = source.skyDirection
        ? altitudeFromSkyDirection(source.skyDirection, atmosphereZenith)
        : 90;
      const atmosphereMagnitude = atmosphericExtinctionMagnitude(
        altitudeDegrees,
        atmospherePreset,
        observationMode,
      );
      const observedMagnitude =
        source.apparentVisualMagnitude + atmosphereMagnitude + daylightPenalty;
      if (!Number.isFinite(observedMagnitude) || observedMagnitude > limitingMagnitude) return;
      const relativeFlux = fluxRatioFromMagnitudeDifference(
        observedMagnitude,
      );
      const detectorSignal = clamp(
        1 - Math.exp(-pointResponseGain * 2 ** displayExposureStops * relativeFlux),
        0,
        1,
      );
      const whiteMix = observationMode === "dark-adapted"
        ? 0.72
        : observationMode === "naked-eye"
          ? clamp(0.64 - 0.12 * detectorSignal, 0.52, 0.64)
          : clamp(0.46 - 0.2 * detectorSignal, 0.24, 0.46);
      const displayedLinearRgb = observationMode === "near-infrared"
        ? [1, 0.56 + source.linearRgb[0] * 0.18, 0.72 + source.linearRgb[2] * 0.12]
        : source.linearRgb;
      const [red, green, blue] = displayedLinearRgb.map((channel) =>
        linearChannelToDisplay(whiteMix + (1 - whiteMix) * channel),
      );
      const scintillation = scintillationActive ? stellarScintillation(scintillationTimeRef.current,
        starScintillationPhase(source.id,index), altitudeDegrees, atmospherePreset, observationMode) : 1;
      visibleSources.push({ source, index, observedMagnitude, detectorSignal, scintillation, red, green, blue });
    });

    for (const visible of visibleSources) {
      const { source, detectorSignal, scintillation, red, green, blue } = visible;
      const coreOpacity = clamp(detectorSignal ** 0.36 * scintillation, 0, 1);
      const coreSize = Math.max(1, pixelRatio * (0.5 + 0.66 * detectorSignal));
      context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${coreOpacity})`;
      context.beginPath();
      context.arc(source.canvasX, source.canvasY, coreSize * 0.55, 0, Math.PI * 2);
      context.fill();
    }

    const brightSources = [...visibleSources]
      .sort((first, second) => second.detectorSignal - first.detectorSignal)
      .slice(0, 48);
    for (const visible of brightSources) {
      const { source, detectorSignal, scintillation, red, green, blue } = visible;
      if (detectorSignal > 0.16) {
        const haloRadius = (2 + 5.5 * detectorSignal ** 0.62) * pixelRatio;
        const halo = context.createRadialGradient(source.canvasX, source.canvasY, 0, source.canvasX, source.canvasY, haloRadius);
        halo.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.42 * detectorSignal ** 0.72 * scintillation})`);
        halo.addColorStop(0.24, `rgba(${red}, ${green}, ${blue}, ${0.15 * detectorSignal ** 0.72 * scintillation})`);
        halo.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        context.fillStyle = halo;
        context.fillRect(source.canvasX - haloRadius, source.canvasY - haloRadius, haloRadius * 2, haloRadius * 2);
      }
    }

    if (observationMode === "camera" || observationMode === "near-infrared") {
      for (const visible of brightSources.slice(0, 8)) {
        const { source, detectorSignal, red, green, blue } = visible;
        if (detectorSignal <= 0.94) continue;
        const spikeLength = (3 + 6 * detectorSignal) * pixelRatio;
        context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${0.11 * detectorSignal})`;
        context.lineWidth = Math.max(0.5, pixelRatio * 0.55);
        context.beginPath();
        context.moveTo(source.canvasX - spikeLength, source.canvasY);
        context.lineTo(source.canvasX + spikeLength, source.canvasY);
        context.moveTo(source.canvasX, source.canvasY - spikeLength);
        context.lineTo(source.canvasX, source.canvasY + spikeLength);
        context.stroke();
      }
    }

    for (const visible of visibleSources) {
      const { source, index } = visible;
      const shouldLabelBenchmark =
        scope === "numerical-benchmark" &&
        showBenchmarkLabels &&
        !source.id.startsWith("field-");
      if (shouldLabelBenchmark) {
        context.globalCompositeOperation = "source-over";
        context.fillStyle = "rgba(211, 225, 227, 0.76)";
        context.font = `${10 * pixelRatio}px system-ui, sans-serif`;
        context.fillText(
          t(`方向核验源 ${String(index + 1).padStart(2, "0")}`),
          source.canvasX + 8 * pixelRatio,
          source.canvasY - 7 * pixelRatio,
        );
        context.globalCompositeOperation = "lighter";
      }
    }
    context.globalCompositeOperation = "source-over";

    if (scope === "galaxy-prediction" && showBenchmarkLabels) {
      const namedStars = projectPreparedGalaxyPointSources(namedPreparedStars, camera, width, height, observerPositionParsec, simulationTimeYears);
      drawObservedStarLabels(context, namedStars, pixelRatio, width, height, atmosphereZenith, atmospherePreset, observationMode, sunAltitudeDegrees, language);
    }
    const selectedObjectPosition=selectedStar?pointSourcePositionAtTime(selectedStar,simulationTimeYears):selectedDeepSky?.positionParsec;
    if(scope==="galaxy-prediction"&&selectedObjectPosition){
      const direction={x:selectedObjectPosition.x-observerPositionParsec.x,y:selectedObjectPosition.y-observerPositionParsec.y,z:selectedObjectPosition.z-observerPositionParsec.z};
      const projected=projectDirectionPerspective(direction,camera,width,height);
      if(projected.visible){
        context.save();context.strokeStyle="rgba(165,211,250,0.9)";context.lineWidth=pixelRatio;
        const radius=(selectedDeepSky?18:10)*pixelRatio;
        context.beginPath();context.arc(projected.canvasX,projected.canvasY,radius,0,Math.PI*2);context.stroke();context.restore();
      }
    }

    if (atmospherePreset !== "space" && sunAltitudeDegrees > -12) {
      const projectedSun = projectDirectionPerspective(
        sunDirection,
        camera,
        width,
        height,
      );
      if (projectedSun.visible) {
        const focalLengthPixels = width /
          (2 * Math.tan((camera.horizontalFieldOfViewDegrees * Math.PI) / 360));
        const solarRadiusPixels = Math.max(
          1.2 * pixelRatio,
          focalLengthPixels * Math.tan(degreesToRadians(0.266)),
        );
        const daylightStrength = clamp((sunAltitudeDegrees + 12) / 42, 0, 1);
        const glowRadius = solarRadiusPixels * (12 + 25 * daylightStrength);
        const glow = context.createRadialGradient(
          projectedSun.canvasX,
          projectedSun.canvasY,
          0,
          projectedSun.canvasX,
          projectedSun.canvasY,
          glowRadius,
        );
        glow.addColorStop(0, `rgba(255, 246, 220, ${0.72 + 0.2 * daylightStrength})`);
        glow.addColorStop(0.08, `rgba(255, 209, 138, ${0.24 + 0.16 * daylightStrength})`);
        glow.addColorStop(1, "rgba(255, 173, 95, 0)");
        context.fillStyle = glow;
        context.fillRect(
          projectedSun.canvasX - glowRadius,
          projectedSun.canvasY - glowRadius,
          glowRadius * 2,
          glowRadius * 2,
        );
        if (sunAltitudeDegrees >= -0.8) {
          context.fillStyle = "rgba(255, 249, 229, 0.98)";
          context.beginPath();
          context.arc(
            projectedSun.canvasX,
            projectedSun.canvasY,
            solarRadiusPixels,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
    }

    if (terrainCanvasRef.current) terrainCanvasRef.current.style.visibility = "hidden";
    if (atmospherePreset !== "space" && planetTerrainAssetVersion > 0) {
      const daylightStrength = clamp((sunAltitudeDegrees + 12) / 42, 0, 1);
      const terrainGpu = terrainGpuRef.current;
      const terrainWidth = Math.min(width,isSkyDragging ? 1280 : 1920);
      const terrainHeight = Math.max(1,Math.round(terrainWidth*height/width));
      if (terrainGpu?.render(camera, terrainWidth, terrainHeight, planetInclinationDegrees, daylightStrength, displayExposureStops)) {
        if (terrainCanvasRef.current) terrainCanvasRef.current.style.visibility = "visible";
      } else if (planetPanoramaRasterRef.current && planetGroundTextureRef.current) {
        // Identical geometry on devices that cannot create a graphics context.
        const projectionWidth = isSkyDragging ? 240 : 640;
        const projectionHeight = Math.max(1, Math.round(projectionWidth * height / width));
        const groundCacheKey = [camera.azimuthDegrees, camera.elevationDegrees, camera.horizontalFieldOfViewDegrees,
          projectionWidth, projectionHeight, planetInclinationDegrees, daylightStrength, displayExposureStops].join("|");
        if (!groundProjectionCanvasRef.current) groundProjectionCanvasRef.current = document.createElement("canvas");
        const projectionCanvas = groundProjectionCanvasRef.current;
        if (groundProjectionCacheKeyRef.current !== groundCacheKey) {
          projectionCanvas.width = projectionWidth; projectionCanvas.height = projectionHeight;
          const projectionContext = projectionCanvas.getContext("2d");
          if (projectionContext) {
            const pixels = projectPlanetTerrainPixels(planetPanoramaRasterRef.current, planetGroundTextureRef.current,
              camera, projectionWidth, projectionHeight, planetInclinationDegrees, daylightStrength, displayExposureStops);
            const raster = projectionContext.createImageData(projectionWidth, projectionHeight);
            raster.data.set(pixels); projectionContext.putImageData(raster, 0, 0);
            groundProjectionCacheKeyRef.current = groundCacheKey;
          }
        }
        context.drawImage(projectionCanvas, 0, 0, width, height);
      }
    }
  }, [atmospherePreset, atmosphereZenith, camera, displayExposureStops, planetInclinationDegrees, simulationTimeYears, skyComputation, skyPoints, deepSkyAssetVersion, drawCurve, enhanceDeepSkyScale, galaxyColourGrade, isSkyDragging, observationMode, observerPositionParsec, planetTerrainAssetVersion, preparedExtragalacticSources, preparedGalaxyPointSources, namedPreparedStars, selectedStar, selectedDeepSky, scope, showBenchmarkLabels, showDeepSkyImages, showCoordinateGrid, showExtragalactic, showGalacticPlane, sunAltitudeDegrees, sunDirection, language, t, scintillationActive]);

  const scheduleDraw = useCallback(() => {
    if (drawRequestRef.current !== null) return;
    drawRequestRef.current = requestAnimationFrame(() => {
      drawRequestRef.current = null;
      try { latestDrawRef.current(); setRenderError(""); }
      catch (error) { console.error("Sky rendering failed", error); setRenderError("部分图层绘制失败，请刷新重试；错误已记录。"); }
    });
  }, []);
  useEffect(() => { latestDrawRef.current = drawSky; scheduleDraw(); }, [drawSky, scheduleDraw]);
  useEffect(() => {
    if (!scintillationActive) return;
    let frame: number | null = null, lastFrame = 0, lastFallback = 0;
    const animate = (milliseconds: number) => {
      if (document.hidden) { frame = null; return; }
      if (milliseconds-lastFrame >= 1000/30) {
        lastFrame = milliseconds; scintillationTimeRef.current = milliseconds/1000;
        // Only the star layer changes: leave dust, terrain and photographs cached.
        const gpu = starsGpuRef.current;
        const drawn = starCanvasRef.current?.style.visibility === 'visible' && gpu?.animateAtmosphere(scintillationTimeRef.current);
        if (!drawn && milliseconds-lastFallback >= 1000/12) { lastFallback = milliseconds; scheduleDraw(); }
      }
      frame = requestAnimationFrame(animate);
    };
    const visibilityChanged = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = document.hidden ? null : requestAnimationFrame(animate);
    };
    visibilityChanged(); document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [scintillationActive, scheduleDraw]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(canvas);
    return () => { resizeObserver.disconnect(); if (drawRequestRef.current !== null) cancelAnimationFrame(drawRequestRef.current); drawRequestRef.current = null; };
  }, [scheduleDraw]);

  const startTutorial=()=>{cancelSkyPointer();setIsTimePlaying(false);setMinimalInterface(false);setSearchOpen(false);setSelectedStarId(null);setSelectedDeepSkyId(null);setActivePanel(null);setTutorialStep(0);};
  const changeTutorialStep=(step:number)=>{setActivePanel(observationTutorialSteps[step].panel);setTutorialStep(step);};
  const finishTutorial=()=>{try{rememberObservationTutorial(window.localStorage);}catch{/* Storage may be disabled. */}setTutorialStep(null);setActivePanel(null);canvasRef.current?.focus();};
  const toggleCentreLock=()=>{
    cancelSkyPointer();
    if(centreLocked){setCamera({azimuthDegrees:camera.azimuthDegrees,elevationDegrees:camera.elevationDegrees,horizontalFieldOfViewDegrees:camera.horizontalFieldOfViewDegrees});setCentreLocked(false);setNavigationNotice("已解除中心锁定，保留当前视角。可以继续拖动转向。");}
    else{setCentreLocked(true);setNavigationNotice("已锁定银河中心。移动位置或播放时间时，视线会持续跟随；关闭后可自由转向。");}
  };

  const closeSearch=()=>{setSearchOpen(false);searchButtonRef.current?.focus();};
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(tutorialStep!==null||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
      const element=event.target as HTMLElement|null;
      if(element?.closest("input,textarea,select,[contenteditable=true]"))return;
      if(event.key==="/"){event.preventDefault();cancelSkyPointer();setSearchOpen(true);setMinimalInterface(false);setActivePanel(null);setSelectedStarId(null);setSelectedDeepSkyId(null);}
      if(event.key==="Escape"){setSearchOpen(false);setSelectedStarId(null);setSelectedDeepSkyId(null);canvasRef.current?.focus();}
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[cancelSkyPointer,tutorialStep]);

  const focusDeepSky=(source:DeepSkyTarget)=>{
    cancelSkyPointer();setCentreLocked(false);setIsTimePlaying(false);setScope("galaxy-prediction");setSelectedStarId(null);setSelectedDeepSkyId(source.id);setSearchOpen(false);setActivePanel(null);
    const direction={x:source.positionParsec.x-observerPositionParsec.x,y:source.positionParsec.y-observerPositionParsec.y,z:source.positionParsec.z-observerPositionParsec.z};
    const target=resolveQuickView(direction,camera,atmosphereZenith,atmospherePreset!=="space");
    const diameter=source.image?.majorPhysicalDiameterParsec??source.galaxy?.majorPhysicalDiameterParsec??1;
    const angularWidth=2*Math.atan(diameter/(2*Math.max(.001,Math.hypot(direction.x,direction.y,direction.z))))*180/Math.PI;
    setCamera({...target.camera,horizontalFieldOfViewDegrees:clamp(angularWidth*2.3,.5,100)});
    if(target.switchToSpace)setAtmospherePreset("space");
    if(source.image){setObservationMode("camera");setShowDeepSkyImages(true);setEnhanceDeepSkyScale(false);}
    if(source.kind==="星系")setShowExtragalactic(true);
    setNavigationNotice(target.switchToSpace?"目标被地平线遮挡，已暂停时间并切换为无大气视图。":source.image?"已暂停时间并进入相机特写；照片色彩不代表裸眼颜色。":"已暂停时间并定位目标。暗弱天体可能需要提高感光或曝光设置。");
  };
  const selectSearchResult=(entry:SkySearchEntry)=>{
    if(entry.kind==="deep-sky"){const target=deepSkyTargetsById.get(entry.id);if(target)focusDeepSky(target);return;}
    const source=observedStarsById.get(entry.id);if(!source)return;
    cancelSkyPointer();setCentreLocked(false);setIsTimePlaying(false);setScope("galaxy-prediction");setSelectedStarId(source.id);setSelectedDeepSkyId(null);setSearchOpen(false);setActivePanel(null);
    const position=pointSourcePositionAtTime(source,simulationTimeYears);
    const target=resolveQuickView({x:position.x-observerPositionParsec.x,y:position.y-observerPositionParsec.y,z:position.z-observerPositionParsec.z},camera,atmosphereZenith,atmospherePreset!=="space");
    setCamera({...target.camera,horizontalFieldOfViewDegrees:Math.min(target.camera.horizontalFieldOfViewDegrees,30)});
    if(target.switchToSpace)setAtmospherePreset("space");
    setNavigationNotice(target.switchToSpace?"目标被地平线遮挡，已暂停时间并切换为无大气视图。":"已暂停时间并居中标记目标；能否看见星光仍取决于距离、大气和感光设置。");
  };

  const navigateToDirection = (direction: Vector3, label: string) => {
    if(label!=="银河中心")setCentreLocked(false);
    const target = resolveQuickView(direction, camera, atmosphereZenith, atmospherePreset !== "space");
    setCamera(target.camera);
    if (target.switchToSpace) {
      setAtmospherePreset("space");
      setNavigationNotice(`${label}被当前地平线遮挡或紧贴地面，已切换为无大气视图。可在“观察”中恢复行星环境。`);
    } else setNavigationNotice("");
  };
  const lookTowardCentre = () => navigateToDirection({ x: -observerPositionParsec.x,
    y: -observerPositionParsec.y, z: -observerPositionParsec.z }, "银河中心");
  const lookTowardOuterGalaxy = () => navigateToDirection(observerPositionParsec, "银河外围");

  const setPositionFromMapPointer = useCallback(
    (clientX: number, clientY: number) => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = map.getBoundingClientRect();
      const mapX = ((clientX - bounds.left) / bounds.width) * MAP_WIDTH;
      const mapY = ((clientY - bounds.top) / bounds.height) * MAP_HEIGHT;
      const xParsec = ((mapX - MAP_CENTRE_X) / MAP_RADIUS) * MAXIMUM_RADIUS_PARSEC;
      const yParsec = ((MAP_CENTRE_Y - mapY) / MAP_RADIUS) * MAXIMUM_RADIUS_PARSEC;
      const update = updateFromPlanarPoint(xParsec, yParsec, MINIMUM_RADIUS_PARSEC, MAXIMUM_RADIUS_PARSEC, positionAzimuthDegrees);
      relocateObserver(update.positionParsec);
    },
    [positionAzimuthDegrees, relocateObserver],
  );

  const panelButton = (name: Exclude<PanelName, null>, label: string) => (
    <button type="button" className={activePanel === name ? "is-active" : ""} onClick={() => {setSearchOpen(false);setSelectedStarId(null);setSelectedDeepSkyId(null);setActivePanel((current) => (current === name ? null : name));}} aria-pressed={activePanel === name}>
      {t(label)}
    </button>
  );

  return (
    <main lang={language === "en" ? "en" : "zh-CN"} className={`planetarium-shell${minimalInterface ? " is-immersed" : ""}`}>
      <canvas ref={skyBackgroundRef} className="sky-background-layer" aria-hidden="true" />
      <canvas ref={photoCanvasRef} className="sky-photo-layer" aria-hidden="true" />
      <canvas ref={starCanvasRef} className="sky-stars-layer" aria-hidden="true" />
      <canvas ref={terrainCanvasRef} className="sky-terrain-layer" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className={`planetarium-sky${isSkyDragging ? " is-dragging" : ""}`}
        tabIndex={0}
        aria-label={scope === "galaxy-prediction" ? t("可拖动的银河系内部天球天幕；包含实测亮星与三维银河模型预测") : t("可拖动的数值核验天幕；不是银河预测")}
        onPointerDown={(event) => {
          if(!skyPointerRef.current.begin(event))return;
          completedSkyGestureRef.current=null;
          event.currentTarget.focus();
        }}
        onPointerMove={(event) => {
          const movement=skyPointerRef.current.move(event);
          if(!movement){if(skyPointerRef.current.activePointerId===null)setIsSkyDragging(false);return;}
          if(centreLocked)return;
          if(movement.started){
            setIsSkyDragging(true);
            try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Global release handling remains active. */}
          }
          const pointerScale=camera.horizontalFieldOfViewDegrees/event.currentTarget.clientWidth;
          setCamera(current=>({...current,azimuthDegrees:normalizeDegrees(current.azimuthDegrees+movement.deltaX*pointerScale),
            elevationDegrees:clamp(current.elevationDegrees-movement.deltaY*pointerScale,-89.9,89.9)}));
        }}
        onPointerUp={finishSkyPointer}
        onPointerCancel={cancelSkyPointer}
        onLostPointerCapture={()=>{if(skyPointerRef.current.activePointerId!==null)cancelSkyPointer();}}
        onClick={(event) => {
          const gesture=completedSkyGestureRef.current;
          completedSkyGestureRef.current=null;
          if(!gesture||gesture.dragged||scope!=="galaxy-prediction")return;
          // Picking is independent of the press lifecycle, so even a failed
          // catalogue lookup cannot leave the camera attached to the mouse.
          try{
            const rect=event.currentTarget.getBoundingClientRect();
            if(atmospherePreset!=="space"&&isSkyPointObscured(camera,rect.width,rect.height,gesture.x-rect.left,gesture.y-rect.top,planetInclinationDegrees,planetPanoramaRasterRef.current)){
              setSelectedStarId(null);setSelectedDeepSkyId(null);setNavigationNotice("这里是被地表遮挡的方向。可以通过搜索定位天体。");return;
            }
            const hit=pickObservedStar(preparedGalaxyPointSources??[],camera,observerPositionParsec,simulationTimeYears,
              rect.width,rect.height,gesture.x-rect.left,gesture.y-rect.top,gesture.pointerType==="touch"?22:12,
              atmosphereZenith,atmospherePreset,observationMode,sunAltitudeDegrees);
            const ratioX=event.currentTarget.width/rect.width,ratioY=event.currentTarget.height/rect.height;
            const deepHit=pickDeepSkyTarget(deepSkyHitAreasRef.current,(gesture.x-rect.left)*ratioX,(gesture.y-rect.top)*ratioY,(gesture.pointerType==="touch"?12:7)*ratioX);
            const tightStar=hit&&Math.hypot(hit.canvasX-(gesture.x-rect.left),hit.canvasY-(gesture.y-rect.top))<=(gesture.pointerType==="touch"?8:4);
            if(deepHit&&!tightStar){setSelectedDeepSkyId(deepHit.id);setSelectedStarId(null);setSearchOpen(false);setActivePanel(null);setNavigationNotice("");}
            else if(hit&&observedStarsById.has(hit.id)){setSelectedStarId(hit.id);setSelectedDeepSkyId(null);setSearchOpen(false);setActivePanel(null);setNavigationNotice("");}
            else{setSelectedStarId(null);setSelectedDeepSkyId(null);setNavigationNotice("没有选中已载入的天体。可以点击星云、星团，或用左侧搜索查找名称与星表编号。");}
          }catch(error){console.error("Object selection failed",error);setNavigationNotice("这次未能读取天体资料，请重新点选。视角已停止拖动。");}
        }}
        onWheel={(event) => {
          event.preventDefault();
          setCamera((current) => ({ ...current, horizontalFieldOfViewDegrees: clamp(current.horizontalFieldOfViewDegrees * Math.exp(event.deltaY * 0.0015), 0.5, 140) }));
        }}
        onKeyDown={(event) => {
          const azimuthStep = event.key === "ArrowLeft" ? -3 : event.key === "ArrowRight" ? 3 : 0;
          const elevationStep = event.key === "ArrowUp" ? 3 : event.key === "ArrowDown" ? -3 : 0;
          const fieldOfViewStep = event.key === "+" ? -5 : event.key === "-" ? 5 : 0;
          if (azimuthStep === 0 && elevationStep === 0 && fieldOfViewStep === 0) return;
          if(centreLocked&&(azimuthStep!==0||elevationStep!==0)){event.preventDefault();return;}
          event.preventDefault();
          setCamera((current) => ({
            ...current,
            azimuthDegrees: normalizeDegrees(current.azimuthDegrees + azimuthStep),
            elevationDegrees: clamp(current.elevationDegrees + elevationStep, -89.9, 89.9),
            horizontalFieldOfViewDegrees: clamp(current.horizontalFieldOfViewDegrees * Math.exp(fieldOfViewStep / 25), 0.5, 140),
          }));
        }}
      />

      {tutorialStep!==null&&<ObservationTutorial step={tutorialStep} onStep={changeTutorialStep} onClose={finishTutorial}/>}
      {searchOpen&&<SkySearch index={searchIndex} loading={catalogueState==="loading"||gaiaCatalogueState==="loading"} failed={catalogueState==="failed"||gaiaCatalogueState==="failed"} onSelect={selectSearchResult} onClose={closeSearch}/>}
      {selectedDeepSky&&<DeepSkyDetail target={selectedDeepSky} observer={observerPositionParsec} onClose={()=>setSelectedDeepSkyId(null)} onCentre={()=>focusDeepSky(selectedDeepSky)}/>}
      {selectedStar && <StarDetail source={selectedStar} observer={observerPositionParsec} timeYears={simulationTimeYears}
        onClose={() => setSelectedStarId(null)} onCentre={() => {
          const position = pointSourcePositionAtTime(selectedStar, simulationTimeYears);
          navigateToDirection({x:position.x-observerPositionParsec.x,y:position.y-observerPositionParsec.y,z:position.z-observerPositionParsec.z}, starName(selectedStar.displayName,language,selectedStar.id));
        }} />}

      <div className="observatory-header-actions"><button className="observatory-language" type="button" onClick={() => { cancelSkyPointer(); toggleLanguage(); }} aria-label={language === "en" ? "切换为中文" : "Switch to English"}>{language === "en" ? "中文" : "English"}</button>
      <button className="immersion-toggle" type="button" aria-pressed={minimalInterface}
        onClick={() => { setMinimalInterface(!minimalInterface); setActivePanel(null);setSearchOpen(false);setSelectedStarId(null);setSelectedDeepSkyId(null); }}>
        {minimalInterface ? t("显示控制") : t("沉浸观察")}
      </button></div>
      <ObservationMusic position={observerPositionParsec} />
      <div className="compute-status" role="status">{t(renderError) || (computeState === "failed" ? t("背景计算暂不可用，请刷新重试") : computeState === "updating" ? t("正在更新星光与尘埃…") : "")}</div>
      {navigationNotice && <div className="navigation-notice" role="status">{t(navigationNotice)}<button onClick={() => setNavigationNotice("")} type="button" aria-label={t("关闭视角提示")}>×</button></div>}
      <header className="planetarium-topbar">
        <div className="planetarium-brand">
          <img className="observing-brand-logo" src="/brand/logo-starboat.webp" alt={t("银河夜航星舟标志")} width="44" height="44"/>
          <Link href={language === "en" ? "/en" : "/"} aria-label={t("返回银河夜航首页")}><strong>{t("银河夜航")}</strong><small>{t("Galactic Nightflight · 返回首页")}</small></Link>
        </div>
        <div className={scope === "galaxy-prediction" ? "scene-claim prediction" : "scene-claim benchmark"}>
          <i aria-hidden="true" />
          <span>{scope === "galaxy-prediction" ? catalogueState === "ready" && gaiaCatalogueState === "ready" ? t(`银河预测天幕：${observedCatalogueCount.toLocaleString(locale)} 颗观测恒星 + 三维恒星与尘埃模型`) : catalogueState === "loading" || gaiaCatalogueState === "loading" ? t("银河预测天幕：观测星表载入中 + 三维恒星与尘埃模型") : t(`银河预测天幕：${observedCatalogueCount.toLocaleString(locale)} 颗已载入观测恒星 + 三维模型`) : t(`数值核验天幕：${numericalBenchmarkEmitters.length.toLocaleString(locale)} 个确定性三维测试光源`)}</span>
        </div>
        <div className="time-state"><span>{atmospherePreset === "space" ? t("深空视点") : atmospherePreset === "earth-hazy" ? t("行星大气 · 轻雾") : t("行星大气 · 晴朗")}</span><strong>{t(observationModeLabel(observationMode))}</strong></div>
      </header>

      <nav className="planetarium-rail" aria-label={t("观察快捷控制")}>
        <span className="rail-section-label">{t("查找天体")}</span>
        <button data-guide="search" ref={searchButtonRef} type="button" className={searchOpen?"is-active search-trigger":"search-trigger"} aria-expanded={searchOpen} aria-keyshortcuts="/" onClick={()=>{cancelSkyPointer();setSearchOpen(value=>!value);setActivePanel(null);setSelectedStarId(null);setSelectedDeepSkyId(null);}}>{t("搜索天体")}</button>
        <span className="rail-divider" />
        <div className="direction-buttons" data-guide="directions"><span className="rail-section-label">{t("看向方向")}</span>
        <button type="button" onClick={lookTowardCentre}>{t("银河中心")}</button>
        <button type="button" onClick={lookTowardOuterGalaxy}>{t("银河外围")}</button>
        <button type="button" onClick={() => navigateToDirection({x:0,y:0,z:1}, "盘面上方")}>{t("盘面上方")}</button>
        <button type="button" onClick={() => navigateToDirection({x:0,y:0,z:-1}, "盘面下方")}>{t("盘面下方")}</button></div>
        <button data-guide="centre-lock" type="button" role="switch" aria-checked={centreLocked} className={centreLocked?"centre-lock is-active":"centre-lock"} onClick={toggleCentreLock} title={t("开启后持续朝向银河中心；关闭后可以自由拖动")}>{centreLocked?t("中心已锁定"):t("锁定中心")}</button>
        <span className="rail-divider" />
        <button type="button" className={showCoordinateGrid ? "is-active" : ""} onClick={() => setShowCoordinateGrid((value) => !value)} aria-pressed={showCoordinateGrid}>{t("网格")}</button>
        <button type="button" className={showGalacticPlane ? "is-active" : ""} onClick={() => setShowGalacticPlane((value) => !value)} aria-pressed={showGalacticPlane}>{t("银河盘面")}</button>
      </nav>

      <div className="view-reticle" aria-hidden="true"><span /><span /></div>

      <section data-guide="time" className="time-console" aria-label={t("模拟时间控制")}>
        <button type="button" className="time-play" onClick={() => setIsTimePlaying((value) => !value)} aria-pressed={isTimePlaying}>{isTimePlaying ? t("暂停") : t("播放")}</button>
        <button type="button" className={timeDirection < 0 ? "is-active" : ""} onClick={() => setTimeDirection((value) => (value === 1 ? -1 : 1))}>{timeDirection < 0 ? t("反向") : t("正向")}</button>
        <div className="time-slider">
          <span><b>{t("时间流速")}</b><output>{new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(timeSpeedYearsPerSecond)}{t(" 年/秒")}</output></span>
          <input type="range" min="0" max="5" step="0.01" value={timeSpeedPower} onChange={(event) => setTimeSpeedPower(Number(event.target.value))} aria-label={t("时间流速；单位为模拟年每现实秒")} />
        </div>
        <strong className="time-epoch">{t(formatTimeYears(simulationTimeYears, locale))}</strong>
        <button type="button" onClick={resetSimulationTime}>{t("时间归零")}</button>
        <label className="observer-motion"><input type="checkbox" checked={observerFollowsDynamics} onChange={(event) => setObserverFollowsDynamics(event.target.checked)} /><span>{t("观察者随轨道")}</span></label>
      </section>

      <aside className={`planetarium-panel ${activePanel ? "is-open" : ""}`}>
        <div className="panel-tabs">{panelButton("view", t("观察"))}{panelButton("location", t("位置跳转"))}{panelButton("physics", t("物理"))}</div>

        {activePanel === "view" && (
          <div className="panel-body">
            <div className="panel-heading"><div><span>{t("观察设置")}</span><h2>{t("天幕与视线")}</h2></div><button type="button" onClick={() => setActivePanel(null)} aria-label={t("关闭观察设置")}>×</button></div>
            <div className="scope-cards">
              <button type="button" className={scope === "galaxy-prediction" ? "is-active" : ""} onClick={() => setScope("galaxy-prediction")}><strong>{t("银河预测天幕")}</strong><small>{t("太阳附近实测亮星；其余由三维模型推断")}</small></button>
              <button type="button" className={scope === "numerical-benchmark" ? "is-active" : ""} onClick={() => setScope("numerical-benchmark")}><strong>{t("数值核验层")}</strong><small>{t("只检查投影和测光；不代表银河")}</small></button>
            </div>
            <p className="control-definition">{t("单击恒星、星云、星团或星系查看资料；左侧“搜索天体”可按名字定位。拖动转向，滚轮放大。")}</p>
            <div className="deep-sky-targets" aria-label={t("深空天体相机特写")}>{deepSkyImageSources.map(source=><button type="button" key={source.id} onClick={()=>{const target=deepSkyTargetsById.get(source.id.replace(/-image$/,""));if(target)focusDeepSky(target);}}>{t(source.displayName.replace(' M42','').replace(' M45','').replace(' M31',''))}{t(" · 特写")}</button>)}</div>
            <label className="planetarium-range">
              <span><b>{t("水平视场角")}</b><output>{camera.horizontalFieldOfViewDegrees.toFixed(camera.horizontalFieldOfViewDegrees < 10 ? 1 : 0)}°</output></span>
              <input type="range" min="0.5" max="140" step="0.1" value={camera.horizontalFieldOfViewDegrees} onChange={(event) => setCamera((current) => ({ ...current, horizontalFieldOfViewDegrees: Number(event.target.value) }))} />
              <small>{t("画面横向覆盖的角宽；数值越小，放大程度越高。单位为度。")}</small>
            </label>
            <label className="planetarium-range">
              <span><b>{t("盘面仰角")}</b><output>{camera.elevationDegrees.toFixed(1)}°</output></span>
              <input disabled={centreLocked} type="range" min="-89.9" max="89.9" step="0.1" value={camera.elevationDegrees} onChange={(event) => setCamera((current) => ({ ...current, elevationDegrees: Number(event.target.value) }))} />
              <small>{centreLocked?t("关闭中心锁定后可调整。"):""}{t("视线离开银河盘面的角度；正值朝盘面上方，负值朝下方。单位为度。")}</small>
            </label>
            <p className="control-definition">{t("行星模式下，镜头保持当地竖直方向，银河带随行星地平朝向呈现相应倾斜；进入无大气模式后，以银河盘上方作为画面向上方向。")}</p>
            <p className="control-definition">{t("银河坐标网格表示以银河中心坐标轴为基准的经纬角线，只帮助判断视线方向，不表示恒星或银河辉光。")}</p>
            <div className="overlay-switches">
              <label><input type="checkbox" checked={showCoordinateGrid} onChange={(event) => setShowCoordinateGrid(event.target.checked)} /><span>{t("银河坐标网格")}</span></label>
              <label><input type="checkbox" checked={showGalacticPlane} onChange={(event) => setShowGalacticPlane(event.target.checked)} /><span>{t("银河盘面基准线")}</span></label>
              <label><input type="checkbox" checked={showBenchmarkLabels} onChange={(event) => setShowBenchmarkLabels(event.target.checked)} /><span>{scope === "galaxy-prediction" ? t("亮星名称") : t("方向核验源标签")}</span></label>
              <label><input type="checkbox" checked={showExtragalactic} onChange={(event) => setShowExtragalactic(event.target.checked)} /><span>{t("银河系外星系")}</span></label>
              <label><input type="checkbox" checked={showDeepSkyImages} onChange={(event) => setShowDeepSkyImages(event.target.checked)} /><span>{t("深空观测影像")}</span></label>
              <label><input type="checkbox" checked={enhanceDeepSkyScale} onChange={(event) => setEnhanceDeepSkyScale(event.target.checked)} /><span>{t("影像辨认尺度增强")}</span></label>
            </div>
            <div data-guide="response" className="observation-modes"><span>{t("感光响应")}</span><div><button className={observationMode === "naked-eye" ? "is-active" : ""} onClick={() => setObservationMode("naked-eye")} type="button">{t("裸眼")}</button><button className={observationMode === "dark-adapted" ? "is-active" : ""} onClick={() => setObservationMode("dark-adapted")} type="button">{t("暗适应")}</button><button className={observationMode === "camera" ? "is-active" : ""} onClick={() => setObservationMode("camera")} type="button">{t("相机")}</button><button className={observationMode === "near-infrared" ? "is-active" : ""} onClick={() => setObservationMode("near-infrared")} type="button">{t("近红外")}</button></div><p>{t(observationModeDescription(observationMode))}</p></div>
            <div className="observation-modes"><span>{t("显示色彩")}</span><div><button className={galaxyColourGrade === "observational" ? "is-active" : ""} onClick={() => setGalaxyColourGrade("observational")} type="button">{t("观测映射")}</button><button className={galaxyColourGrade === "immersive" ? "is-active" : ""} onClick={() => setGalaxyColourGrade("immersive")} type="button">{t("沉浸增强")}</button></div><p>{t("沉浸增强只提高相机画面的色彩分离和局部对比度，不改变天体位置、距离、星数、银河宽度或尘埃消光。")}</p></div>
            <p className="control-definition">{t("深空观测影像来自欧洲南方天文台、哈勃望远镜及巡天项目，只在可见光相机模式显示。辨认尺度增强会放大角尺寸过小的影像，但不会改变物理模型；关闭后恢复计算角尺度。")}</p>
            <label className="planetarium-range"><span><b>{t("显示曝光")}</b><output>{displayExposureStops > 0 ? "+" : ""}{displayExposureStops.toFixed(1)}{t(" 级")}</output></span>
              <input type="range" min="-2" max="3" step="0.1" value={displayExposureStops} onChange={event => setDisplayExposureStops(Number(event.target.value))} />
              <small>{t("用于调节屏幕上的星光亮度。每增加 1 级，显示前的线性星光信号加倍；越大越亮，也越容易失去亮部细节。它不是实际快门时间。")}</small>
            </label>
            <div className="atmosphere-controls">
              <span>{t("行星大气")}</span>
              <div className="atmosphere-cards">
                <button type="button" className={atmospherePreset === "space" ? "is-active" : ""} onClick={() => setAtmospherePreset("space")}><strong>{t("无大气")}</strong><small>{t("轨道或深空视点")}</small></button>
                <button type="button" className={atmospherePreset === "earth-clear" ? "is-active" : ""} onClick={() => setAtmospherePreset("earth-clear")}><strong>{t("晴朗")}</strong><small>{t("较低消光与地平辉光")}</small></button>
                <button type="button" className={atmospherePreset === "earth-hazy" ? "is-active" : ""} onClick={() => setAtmospherePreset("earth-hazy")}><strong>{t("轻雾")}</strong><small>{t("较强散射与近地平衰减")}</small></button>
              </div>
              {atmospherePreset !== "space" && <>
                <label className="scintillation-control"><input type="checkbox" checked={scintillationEnabled} onChange={event=>setScintillationEnabled(event.target.checked)}/><span>{language==='en'?'Atmospheric star twinkling':'大气中的星光闪烁'}</span></label>
                <p className="control-definition">{reducedMotion ? (language==='en'?'Twinkling is paused to follow your reduced-motion preference.':'已遵循系统的减少动态效果设置，暂停闪烁。') : (language==='en'?'Stars shimmer independently, more noticeably near the horizon. Twinkling continues while galactic time is paused.':'星光各自轻微明暗起伏，靠近地平线时更明显。暂停银河时间后，闪烁仍会继续。')}</p>
                <label className="planetarium-range"><span><b>{t("行星地平倾角")}</b><output>{planetInclinationDegrees}°</output></span>
                  <input type="range" min="-75" max="75" step="1" value={planetInclinationDegrees} onChange={event => setPlanetInclinationDegrees(Number(event.target.value))} />
                  <small>{t("行星地平面相对银河盘的倾斜角，单位为度，没有优劣之分。它改变哪些天体位于地平线上方；与盘面仰角不同，这里转动行星坐标系，镜头不转动。当前是可控的假想行星环境，不代表地球某个地点。")}</small>
                </label>
                <div className="observation-modes twilight-presets"><span>{t("当地晨昏")}</span><div><button type="button" className={sunAltitudeDegrees === -18 ? "is-active" : ""} onClick={() => setSunAltitudeDegrees(-18)}>{t("深夜")}</button><button type="button" className={sunAltitudeDegrees === -12 ? "is-active" : ""} onClick={() => setSunAltitudeDegrees(-12)}>{t("天文暮光")}</button><button type="button" className={sunAltitudeDegrees === -6 ? "is-active" : ""} onClick={() => setSunAltitudeDegrees(-6)}>{t("民用暮光")}</button><button type="button" className={sunAltitudeDegrees === 0 ? "is-active" : ""} onClick={() => setSunAltitudeDegrees(0)}>{t("日出日落")}</button><button type="button" className={sunAltitudeDegrees === 30 ? "is-active" : ""} onClick={() => setSunAltitudeDegrees(30)}>{t("白昼")}</button></div></div>
                <label className="planetarium-range twilight-range"><span><b>{t("当地恒星高度")}</b><output>{sunAltitudeDegrees > 0 ? "+" : ""}{sunAltitudeDegrees.toFixed(0)}°</output></span><input type="range" min="-24" max="60" step="1" value={sunAltitudeDegrees} onChange={(event) => setSunAltitudeDegrees(Number(event.target.value))} /><small>{t("当地恒星高度表示照亮行星大气的恒星相对地平线的角度；负值在地平线下，正值在地平线上。它通过大气散射决定深夜、暮光和白昼。")}</small></label>
                <label className="planetarium-range twilight-range"><span><b>{t("当地恒星方位")}</b><output>{sunAzimuthDegrees.toFixed(0)}°</output></span><input type="range" min="0" max="360" step="1" value={sunAzimuthDegrees} onChange={(event) => setSunAzimuthDegrees(Number(event.target.value))} /><small>{t("当地恒星方位表示光源沿地平线一周的方向，单位为度；它决定暮光与日光在天空哪一侧最亮。")}</small></label>
              </>}
            </div>
          </div>
        )}

        {activePanel === "location" && (
          <div className="panel-body location-panel">
            <div className="panel-heading"><div><span>{t("观察者位置")}</span><h2>{t("银河盘导航")}</h2></div><button type="button" onClick={() => setActivePanel(null)} aria-label={t("关闭位置设置")}>×</button></div>
            <section data-guide="positions" className="observer-presets" aria-label={t("观察位置跳转")}>
              <h3>{t("选择出发位置")}</h3><p>{t("点击坐标会移动观察者，暂停并重置时间。朝向保持不变；开启中心锁定时，朝向会持续跟随银河中心。")}</p>
              <p>{t("坐标依次为横向、纵向、垂直方向，单位都是秒差距。1 秒差距约为 3.26 光年；正负号表示方向，绝对值越大表示离对应坐标平面越远，没有优劣之分。")}</p>
              <div>{observerPresets.map(preset=><button key={preset.id} type="button" aria-pressed={Math.hypot(observerPositionParsec.x-preset.position.x,observerPositionParsec.y-preset.position.y,observerPositionParsec.z-preset.position.z)<.001} onClick={()=>{cancelSkyPointer();setScope("galaxy-prediction");relocateObserver({...preset.position});setNavigationNotice(`已跳转至${t(preset.name)}，模拟时间已归零。${centreLocked?"继续锁定银河中心。":"当前朝向保持不变。"}`);}}><strong>{t(preset.name)}</strong><span>{t(preset.description)}</span><small>{preset.position.x.toLocaleString(locale)} / {preset.position.y.toLocaleString(locale)} / {preset.position.z.toLocaleString(locale)}</small></button>)}</div>
            </section>
            <p className="control-definition">{t("银河中心为坐标原点。横向负方向指向太阳，纵向位于银河盘面内，垂直正方向朝银河盘上方。下面的距离是到银河中心的直线距离，数值越大表示越远。")}</p>
            <svg ref={mapRef} className={`galaxy-minimap ${isMapDragging ? "is-dragging" : ""}`} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={t("银河盘面位置图；点击或拖动观察者点可连续改变位置")} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setIsMapDragging(true); setPositionFromMapPointer(event.clientX, event.clientY); }} onPointerMove={(event) => { if (isMapDragging) setPositionFromMapPointer(event.clientX, event.clientY); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); setIsMapDragging(false); }} onPointerCancel={() => setIsMapDragging(false)}>
              <circle cx={MAP_CENTRE_X} cy={MAP_CENTRE_Y} r={MAP_RADIUS} className="mini-disc" />
              <ellipse cx={MAP_CENTRE_X} cy={MAP_CENTRE_Y} rx="25" ry="8" transform={`rotate(-27 ${MAP_CENTRE_X} ${MAP_CENTRE_Y})`} className="mini-bar" />
              <path d="M 150 115 C 176 94, 202 95, 223 112 C 238 125, 242 143, 235 158" className="mini-spiral" />
              <path d="M 150 115 C 124 136, 98 135, 77 118 C 62 105, 58 87, 65 72" className="mini-spiral" />
              <path d="M 150 115 C 132 92, 107 82, 84 89 C 63 96, 51 111, 49 128" className="mini-spiral faint" />
              <path d="M 150 115 C 168 138, 193 148, 216 141 C 237 134, 249 119, 251 102" className="mini-spiral faint" />
              {[5_000, 10_000, 15_000, 20_000].map((ring) => <circle key={ring} cx={MAP_CENTRE_X} cy={MAP_CENTRE_Y} r={(ring / MAXIMUM_RADIUS_PARSEC) * MAP_RADIUS} className="mini-ring" />)}
              <line x1={MAP_CENTRE_X - MAP_RADIUS} y1={MAP_CENTRE_Y} x2={MAP_CENTRE_X + MAP_RADIUS} y2={MAP_CENTRE_Y} className="mini-axis" />
              <line x1={MAP_CENTRE_X} y1={MAP_CENTRE_Y - MAP_RADIUS} x2={MAP_CENTRE_X} y2={MAP_CENTRE_Y + MAP_RADIUS} className="mini-axis" />
              <circle cx={MAP_CENTRE_X} cy={MAP_CENTRE_Y} r="3.5" className="mini-centre" />
              <text x={MAP_CENTRE_X + 8} y={MAP_CENTRE_Y - 7}>{t("银河中心")}</text>
              <circle cx={sunMapPoint.x} cy={sunMapPoint.y} r="3" className="mini-sun" />
              <text x={sunMapPoint.x + 7} y={sunMapPoint.y + 13}>{t("太阳锚点")}</text>
              <line x1={observerMapPoint.x} y1={observerMapPoint.y} x2={viewArrowEnd.x} y2={viewArrowEnd.y} className="mini-view" />
              <circle cx={observerMapPoint.x} cy={observerMapPoint.y} r="7" className="mini-observer-halo" />
              <circle cx={observerMapPoint.x} cy={observerMapPoint.y} r="3.7" className="mini-observer" />
            </svg>
            <label className="planetarium-range radius-range"><span><b>{t("银河中心距离")}</b><output>{formatParsec(radiusParsec)}{t(" 秒差距")}</output></span><input type="range" min="0" max="1" step="0.00001" value={sliderFromRadius(radiusParsec)} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setIsPositionScrubbing(true); }} onPointerUp={() => setIsPositionScrubbing(false)} onBlur={() => setIsPositionScrubbing(false)} onPointerCancel={() => setIsPositionScrubbing(false)} onChange={(event) => relocateObserver(updateRadiusPreservingAzimuth(observerPositionParsec, radiusFromSlider(Number(event.target.value)), positionAzimuthDegrees))} /><small>{t("保持当前银河方位不变，沿银河中心与观察者连线连续移动。恒星方向与距离随滑杆实时变化，尘埃和银河背景在后台更新；探针重新定位会把模拟时间归零。")}</small></label>
            <dl className="position-readout"><div><dt>{t("横向坐标")}</dt><dd>{formatParsec(observerPositionParsec.x)}{t(" 秒差距")}</dd></div><div><dt>{t("纵向坐标")}</dt><dd>{formatParsec(observerPositionParsec.y)}{t(" 秒差距")}</dd></div><div><dt>{t("垂直坐标")}</dt><dd>{formatParsec(observerPositionParsec.z)}{t(" 秒差距")}</dd></div><div><dt>{t("银河方位")}</dt><dd>{positionAzimuthDegrees.toFixed(2)}°</dd></div></dl>
            <p className="control-definition coordinate-definition">{t("银河方位表示观察者绕银河中心所处的角度，决定站在哪里；它与观察方位不同，后者只决定朝哪里看。单位为度。当前轨道速度为 ")}{observerSpeedKilometresPerSecond.toFixed(1)}{t(" 千米/秒，方向由三维速度分量共同决定。")}</p>
            <p className="control-definition coordinate-definition">{t("视点移动造成的方向变化称为视差：附近恒星会明显改写原有星座形状，遥远星系只会轻微移动。半人马座 A 是约 380 万秒差距外的星系，不是附近的半人马座恒星；从太阳位置向内移动约 3,200 秒差距时，它的方向变化通常不到约 0.05°。")}</p>
          </div>
        )}

        {activePanel === "physics" && (
          <div className="panel-body physics-panel">
            <div className="panel-heading"><div><span>{t("科学状态")}</span><h2>{t("物理与数据来源")}</h2></div><button type="button" onClick={() => setActivePanel(null)} aria-label={t("关闭物理状态")}>×</button></div>
            <div className="physics-state-card is-prediction"><i aria-hidden="true" /><div><strong>{t("观测约束下的模型预测")}</strong><p>{t("当前画面不是空白占位，也不声称是完整真值。实测星点与模型推断分别标记；三维恒星密度和尘埃决定银河带的亮度、宽度与暗带。新增的小尺度尘埃起伏是固定三维统计模型，不是已观测云团的位置。")}</p></div></div>
            <div className="data-layer-list">
              <div><i className="observed" /><span><strong>{language==='en'?'Nearby stellar supplement':'近邻恒星补充'}</strong><small>{language==='en'?`${nearbyStars.length} SIMBAD entries within 10 pc, including Proxima Centauri and Barnard’s Star. Adds faint neighbours and enriches overlapping Gaia entries without drawing them twice; this is not a complete census.`:`SIMBAD 补充太阳周围 10 秒差距内的 ${nearbyStars.length} 条恒星资料，包含比邻星和巴纳德星。补入暗弱近邻，并合并已有 Gaia 记录；这仍不是完整近邻星表。`}</small></span></div>
              <div><i className="observed" /><span><strong>{t("直接观测")}</strong><small>{t("耶鲁亮星表补足 6.5 星等以内的最亮恒星；Gaia 第三批数据提供 6.5 至 8.5 星等（表示从观测位置看到的亮度，数值越小越亮）的恒星，具备完整六维相空间的 ")}{gaiaCatalogueState === "ready" ? t(`${gaiaBrightStars.length.toLocaleString(locale)} 颗恒星`) : gaiaCatalogueState === "loading" ? t("载入中") : t("载入失败")}{t("。六维相空间表示三个位置分量与三个速度分量。")}</small></span></div>
              <div><i className="inferred" /><span><strong>{t("模型推断")}</strong><small>{modelPopulationEmitters.length.toLocaleString(locale)}{t(" 个恒星族群示踪点；银河盘、厚盘、棒、核球与核星盘连续辐射场。")}</small></span></div>
              <div><i className="observed" /><span><strong>{t("银河系外天体")}</strong><small>{cataloguedExtragalacticSources.length}{t(" 个有目录约束的近邻星系，加上 ")}{statisticalBackgroundGalaxies.length.toLocaleString(locale)}{t(" 个统计背景星系；距离、角大小和银河尘埃随视点重算。")}</small></span></div>
              <div><i className="observed" /><span><strong>{t("深空观测影像")}</strong><small>{deepSkyImageSources.length}{t(" 个天文观测影像；三张改用完整宽视场照片，图幅与朝向按来源说明投影。照片色彩不代表裸眼颜色。")}</small></span></div>
              <div><i className="uncertain" /><span><strong>{t("不确定部分")}</strong><small>{t("远离太阳的单颗恒星身份、螺旋臂细节和全银河尘埃小尺度结构；属于统计近似，尚未完成全银河校准，不保证具体星座。")}</small></span></div>
            </div>
            <div className="physics-readout"><div><span>{t("当前画面")}</span><strong>{scope === "galaxy-prediction" ? t("实测、统计推断与系外天体叠加") : t("确定性数值核验")}</strong></div><div><span>{t("逐星三维重投影")}</span><strong>{t("已启用；恒星位置减去观察者位置后重新投向相机")}</strong></div><div><span>{t("三维尘埃")}</span><strong>{scope === "galaxy-prediction" ? t("逐视线积分；波长相关红化") : t("核验层不接入")}</strong></div><div><span>{t("未分辨星光")}</span><strong>{scope === "galaxy-prediction" ? t("96 段发光与吸收联合积分") : t("核验层不注入")}</strong></div><div><span>{t("运动")}</span><strong>{t("Gaia 实测速度与族群初态传播；观察者跃蛙积分")}</strong></div><div><span>{t("时间")}</span><strong>{t(formatTimeYears(simulationTimeYears, locale))} · {new Intl.NumberFormat(locale).format(timeSpeedYearsPerSecond)}{t(" 年/秒")}</strong></div><div><span>{t("位置驱动视觉参数")}</span><strong>{t("无；响应只由感光和大气决定")}</strong></div></div>
            <details className="model-details"><summary>{t("本轮科学与显示改进")}</summary>
              <p>{t("银河光采用分段发光与吸收的解析积分，计入光源所在分段自身的尘埃遮挡。视点和恒星运动连续重投影；计算中的尘埃与背景暂用最近结果，并显示更新状态。")}</p>
              <p>{t("行星地景独立于银河盘，远景与近地面共同使用相机射线投影。地貌是艺术素材，不是指定行星的实测地形。")}</p>
              <p>{t("连续银河光、点源亮度和大气仍是可视化近似；没有完成统一绝对测光标定、恒星样本完备性校准及两类星光的严格去重。恒星运动仍采用直线外推，时间越长误差可能越大。")}</p>
              <a href="/data/SCIENCE_DISPLAY_UPDATE.md">{t("模型、近似与依据")}</a>
            </details>
            <details className="model-details"><summary>{t("观测照片署名")}</summary>
              <p><a href="https://www.eso.org/public/images/eso1723a/" target="_blank" rel="noreferrer">{t("猎户座星云")}</a>：ESO/G. Beccari</p>
              <p><a href="https://www.eso.org/public/images/eso1119b/" target="_blank" rel="noreferrer">{t("欧米茄星团")}</a>：ESO/INAF-VST/OmegaCAM. Acknowledgement: A. Grado, L. Limatola/INAF-Capodimonte Observatory</p>
              <p><a href="https://esahubble.org/images/heic1502b/" target="_blank" rel="noreferrer">{t("仙女座星系")}</a>：NASA, ESA, Digitized Sky Survey 2 (Acknowledgement: Davide De Martin)</p>
              <p>{t("以上三张按")}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{t("署名许可第四版")}</a>{t("使用；显示时做天空底色扣除与边缘渐隐。")}<a href="https://www.eso.org/public/copyright/" target="_blank" rel="noreferrer">{t("欧洲南方天文台条款")}</a> · <a href="https://esahubble.org/copyright/" target="_blank" rel="noreferrer">{t("欧洲空间局哈勃条款")}</a></p>
              <p>{t("昴星团：NASA, ESA, AURA/Caltech, Palomar Observatory；")}<a href="https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-45/" target="_blank" rel="noreferrer">{t("来源说明")}</a>。</p>
            </details>
            <details className="model-details"><summary>{t("仍未完成的严格生产验证")}</summary><p>{t("当前版本已经能生成物理来源明确的银河天幕，但完整生产声明仍需要银河旋转曲线、星数分布、太阳位置全天亮度、内银河红外星数和尘埃后验样本的联合验收。尚未完成的项目不会让画面变空，而会继续作为不确定性显示。")}</p><ul className="compact-blockers">{productionRenderBlockers.slice(0, 4).map((blocker) => <li key={blocker}>{t(blocker)}</li>)}</ul><a href="/data/PHYSICAL_MODEL_AND_DATA_ARCHITECTURE.md">{t("查看完整物理架构与数据来源")}</a><a href="/data/gaia-dr3-bright-6d-source.json">{t("查看 Gaia 六维样本来源与筛选条件")}</a><a href="/data/deep-sky-image-sources.json">{t("查看深空影像来源与色彩说明")}</a><a href="/data/terrain-asset-source.json">{t("查看行星地貌素材与投影说明")}</a></details>
          </div>
        )}
      </aside>

      <footer className="planetarium-statusbar">
        <div><span>{t("观察者")}</span><strong>{formatParsec(observerPositionParsec.x)} / {formatParsec(observerPositionParsec.y)} / {formatParsec(observerPositionParsec.z)}{t(" 秒差距")}</strong><em>{scope === "galaxy-prediction" ? t("实测 + 模型") : t("核验层")}</em></div>
        <div className="view-readout"><span>{t("方位角 ")}{camera.azimuthDegrees.toFixed(1)}°</span><i aria-hidden="true" /><span>{t("仰角 ")}{camera.elevationDegrees.toFixed(1)}°</span><i aria-hidden="true" /><span>{t("视场角 ")}{camera.horizontalFieldOfViewDegrees.toFixed(camera.horizontalFieldOfViewDegrees < 10 ? 1 : 0)}°</span></div>
        <div className="status-actions"><button type="button" onClick={startTutorial}>{t("新手教程")}</button>{panelButton("view", t("观察"))}{panelButton("location", t("位置跳转"))}{panelButton("physics", t("物理验证"))}</div>
      </footer>
      <div className="drag-hint">{centreLocked?t("持续指向银河中心 · 可滚轮缩放 · 关闭锁定后自由转向"):t("拖动转向 · 滚轮放大 · 单击天体查看资料 · 按 / 搜索")}</div>
    </main>
  );
}
