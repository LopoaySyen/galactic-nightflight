import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "schema-utils/node_modules/ajv/dist/2020.js";
import { modelComponents } from "../lib/science/model-manifest.ts";

const observerComponentUrl = new URL(
  "../app/components/observer-coordinate-lab.tsx",
  import.meta.url,
);
const rendererComponentUrl = new URL(
  "../app/components/planetarium-scene.tsx",
  import.meta.url,
);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const benchmarkCatalogUrl = new URL(
  "../lib/rendering/benchmark-catalog.ts",
  import.meta.url,
);
const modelCatalogUrl = new URL(
  "../lib/rendering/model-star-catalog.ts",
  import.meta.url,
);
const galaxyRadianceUrl = new URL(
  "../lib/rendering/galaxy-radiance.ts",
  import.meta.url,
);
const extragalacticCatalogUrl = new URL(
  "../lib/rendering/extragalactic-catalog.ts",
  import.meta.url,
);
const atmosphereUrl = new URL(
  "../lib/rendering/planet-atmosphere.ts",
  import.meta.url,
);
const kinematicsUrl = new URL("../lib/physics/kinematics.ts", import.meta.url);
const manifestUrl = new URL("../public/data/model-manifest.json", import.meta.url);
const artifactSchemaUrl = new URL(
  "../public/data/scientific-artifact.schema.json",
  import.meta.url,
);
const validationSchemaUrl = new URL(
  "../public/data/validation-receipt.schema.json",
  import.meta.url,
);
const modelManifestSchemaUrl = new URL(
  "../public/data/model-manifest.schema.json",
  import.meta.url,
);

test("observer controls cannot directly modify visual outcome fields", async () => {
  const source = await readFile(observerComponentUrl, "utf8");
  for (const forbiddenName of [
    "starCountMultiplier",
    "milkyWayGlowMultiplier",
    "milkyWayAngularWidth",
    "positionDependentExposure",
    "preRenderedSkyInterpolation",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbiddenName));
  }
  assert.doesNotMatch(source, /modelComponents|stellarPopulation|dustVolume/);
});

test("the renderer has no stochastic sky, sky texture or position-driven visual shortcut", async () => {
  const source = await readFile(rendererComponentUrl, "utf8");
  const modelCatalog = await readFile(modelCatalogUrl, "utf8");
  const galaxyRadiance = await readFile(galaxyRadianceUrl, "utf8");
  const extragalacticCatalog = await readFile(extragalacticCatalogUrl, "utf8");
  const atmosphere = await readFile(atmosphereUrl, "utf8");
  const kinematics = await readFile(kinematicsUrl, "utf8");
  for (const forbiddenPattern of [
    /Math\.random/,
    /skybox/i,
    /starCountMultiplier/,
    /milkyWayGlowMultiplier/,
    /positionDependentExposure/,
    /preRenderedSkyInterpolation/,
  ]) {
    for (const inspectedSource of [source, modelCatalog, galaxyRadiance, extragalacticCatalog, atmosphere, kinematics]) {
      assert.doesNotMatch(inspectedSource, forbiddenPattern);
    }
  }
  assert.match(source, /projectNumericalBenchmark/);
  const computeWorker = await readFile(new URL("../lib/rendering/sky-compute.worker.ts", import.meta.url), "utf8");
  const computeHook = await readFile(new URL("../app/components/use-sky-computation.ts", import.meta.url), "utf8");
  assert.match(computeWorker, /renderGalaxyAllSkyRadiancePixels/);
  assert.match(computeWorker, /prepareGalaxyPointSources/);
  assert.match(computeHook, /new Worker/);
  assert.doesNotMatch(source, /renderGalaxyAllSkyRadiancePixels\(/);
  assert.match(source, /projectPreparedGalaxyPointSources/);
  assert.match(computeWorker, /prepareExtragalacticSources/);
  assert.match(source, /projectPreparedExtragalacticSources/);
  assert.match(source, /applyAtmosphereToViewPixels/);
  assert.match(source, /integratePhaseSpaceLeapfrog/);
  assert.match(source, /near-infrared/);
  assert.match(source, /银河系外星系/);
  assert.match(source, /productionRenderBlockers/);
});

test("the generated horizon is camera-projected foreground and never used as a sky or Milky Way texture", async () => {
  const source = await readFile(rendererComponentUrl, "utf8");
  assert.match(source, /panorama\.src = "\/terrain\/planet-terrain-panorama-v2\.webp"/);
  assert.match(source, /groundTexture\.src = "\/terrain\/basalt-ground-texture-v1\.webp"/);
  assert.match(source, /createTerrainGpuRenderer/);
  assert.match(source, /projectPlanetTerrainPixels/);
  assert.doesNotMatch(source, /panoramaLeft|terrainTop|panoramaWidth/);
  assert.doesNotMatch(source, /backgroundImage[^\n]*planet-horizon/i);
});

test("the new introduction and the full-screen observing route remain separate", async () => {
  const page = await readFile(pageUrl, "utf8");
  const observingPage = await readFile(new URL("../app/observe/page.tsx", import.meta.url), "utf8");
  const source = await readFile(rendererComponentUrl, "utf8");
  assert.match(page, /night-home/);
  const home = await readFile(new URL("../app/components/night-home.tsx", import.meta.url), "utf8");
  assert.match(home, /href=\{observeHref\}/);
  assert.match(home, /'\/observe\?lang=en'/);
  assert.match(home, /'\/observe'/);
  assert.doesNotMatch(page, /PlanetariumScene/);
  assert.match(observingPage, /PlanetariumScene/);
  assert.doesNotMatch(observingPage, /home-hero/);
  assert.match(source, /planetarium-sky/);
  assert.match(source, /planetarium-statusbar/);
  assert.match(source, /galaxy-minimap/);
});

test("the numerical benchmark is fixed, labelled test-only and isolated from the production gate", async () => {
  const catalog = await readFile(benchmarkCatalogUrl, "utf8");
  const productionGate = await readFile(
    new URL("../lib/rendering/production-gate.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(catalog, /Math\.random/);
  assert.match(catalog, /deterministic-benchmark-emitter/);
  assert.doesNotMatch(productionGate, /benchmark-catalog|numericalBenchmarkEmitters/);
});

test("human and camera response modules contain no galactocentric position shortcut", async () => {
  const human = await readFile(
    new URL("../lib/observation/human-vision.ts", import.meta.url),
    "utf8",
  );
  const camera = await readFile(
    new URL("../lib/observation/camera.ts", import.meta.url),
    "utf8",
  );
  for (const source of [human, camera]) {
    assert.doesNotMatch(source, /galactocentric|observerPosition|centreDistance|Math\.random/i);
    assert.match(source, /requireProviderValue/);
  }
});

test("model manifest fails closed and names every forbidden direct control", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.equal(manifest.rendererGate.unlocked, false);
  assert.equal(manifest.status, "architecture-only");
  assert.match(manifest.currentScientificClaim, /尚未生成/);
  assert.ok(manifest.targetScientificClaim);
  assert.equal("scientificClaim" in manifest, false);
  assert.equal(manifest.artifactContract.syntheticVisualFallbackAllowed, false);
  assert.equal(manifest.artifactContract.missingDataBehaviour, "typed-unavailable-error");
  assert.deepEqual(manifest.rendererGate.forbiddenDirectControls.sort(), [
    "milkyWayAngularWidth",
    "milkyWayGlowMultiplier",
    "positionDependentExposure",
    "preRenderedSkyInterpolation",
    "starCountMultiplier",
  ]);
});

test("every production model family declares a source or an explicit unresolved status", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  for (const model of manifest.modelFamilies) {
    assert.ok(
      model.source || model.sources?.length > 0 || /not-frozen|unresolved/.test(model.status),
      `${model.modelId} has neither provenance nor an explicit unresolved status`,
    );
  }
});

test("the mass ledger exposes all nine required gravitational components", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const expectedIds = [
    "thin-stellar-disc",
    "thick-stellar-disc",
    "galactic-bar",
    "box-peanut-bulge",
    "nuclear-stellar-disc",
    "nuclear-star-cluster",
    "gas-mass",
    "dark-matter-halo",
    "central-black-hole",
  ];
  assert.deepEqual(
    manifest.massLedger.components.map((component) => component.id).sort(),
    [...expectedIds].sort(),
  );
  assert.deepEqual(
    modelComponents.map((component) => component.id).sort(),
    [...expectedIds].sort(),
  );
  for (const component of manifest.massLedger.components) {
    assert.ok(component.owner && component.retained && component.excluded);
  }
});

test("scientific artifacts and validation receipts are closed, auditable schemas", async () => {
  const artifactSchema = JSON.parse(await readFile(artifactSchemaUrl, "utf8"));
  const validationSchema = JSON.parse(await readFile(validationSchemaUrl, "utf8"));
  const modelSchema = JSON.parse(await readFile(modelManifestSchemaUrl, "utf8"));

  assert.equal(artifactSchema.additionalProperties, false);
  assert.ok(artifactSchema.required.includes("sha256"));
  assert.ok(artifactSchema.required.includes("validationReceiptIds"));
  assert.equal("capabilityState" in artifactSchema.properties, false);

  assert.equal(validationSchema.additionalProperties, false);
  assert.ok(validationSchema.required.includes("inputSha256"));
  assert.ok(validationSchema.required.includes("dependencyArtifacts"));
  assert.ok(validationSchema.required.includes("referenceDatasets"));
  assert.ok(validationSchema.required.includes("validatorCodeCommit"));
  assert.deepEqual(validationSchema.properties.overallStatus.enum, ["passed", "failed"]);
  assert.equal(validationSchema.allOf[0].then.properties.metrics.items.properties.passed.const, true);

  assert.equal(modelSchema.properties.status.const, "architecture-only");
  assert.equal(modelSchema.properties.rendererGate.properties.unlocked.const, false);

  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateArtifact = ajv.compile(artifactSchema);
  const validateReceipt = ajv.compile(validationSchema);
  const validateManifest = ajv.compile(modelSchema);
  const digest = "a".repeat(64);
  const artifact = {
    artifactId: "test-artifact",
    schemaVersion: "1.0.0",
    source: {
      title: "Test only",
      url: "https://example.invalid/test",
      version: "1",
      codeCommit: null,
      license: "test-only",
    },
    sha256: digest,
    frame: {
      id: "test-frame",
      origin: "test-origin",
      handedness: "right-handed",
      xAxis: "+x",
      yAxis: "+y",
      zAxis: "+z",
      referenceEpoch: "test-epoch",
    },
    units: { length: "parsec" },
    validity: {
      spatialDomain: "test-only",
      temporalDomain: "test-only",
      extrapolationPolicy: "forbidden",
    },
    uncertaintyVariantId: "test-variant",
    generationReceiptId: "generation-1",
    validationReceiptIds: [],
  };
  assert.equal(validateArtifact(artifact), true, JSON.stringify(validateArtifact.errors));

  const receipt = {
    receiptId: "validation-1",
    artifactId: "test-artifact",
    createdAt: "2026-08-20T00:00:00Z",
    validatorVersion: "1.0.0",
    validatorCodeCommit: "abcdef1",
    inputSha256: digest,
    dependencyArtifacts: [],
    referenceDatasets: [
      { datasetId: "test-reference", version: "1", sha256: "b".repeat(64) },
    ],
    selectionFunctionIds: [],
    withheldValidationData: true,
    metrics: [
      { name: "metric", value: 1, unit: "dimensionless", acceptanceRule: "value = 1", passed: false },
    ],
    overallStatus: "passed",
  };
  assert.equal(validateReceipt(receipt), false);
  receipt.metrics[0].passed = true;
  assert.equal(validateReceipt(receipt), true, JSON.stringify(validateReceipt.errors));
  assert.equal(validateManifest(JSON.parse(await readFile(manifestUrl, "utf8"))), true, JSON.stringify(validateManifest.errors));
});

test('continuous playback cannot cancel the background-dispatch clock or scheduled draw', async () => {
  const hook=await readFile(new URL('../app/components/use-sky-computation.ts',import.meta.url),'utf8');
  const source=await readFile(rendererComponentUrl,'utf8');
  assert.match(hook,/setInterval/);
  assert.doesNotMatch(hook,/setTimeout|clearTimeout/);
  assert.match(source,/if \(drawRequestRef.current !== null\) return/);
});

test('normal sky and terrain rendering avoid GPU-to-2D readback and CPU star projection', async () => {
  const source=await readFile(rendererComponentUrl,'utf8');
  assert.match(source,/createStarGpuRenderer/);
  assert.match(source,/createSkyBackgroundGpuRenderer/);
  assert.match(source,/projectedSources = starsOnGpu \? \[\]/);
  assert.doesNotMatch(source,/drawImage\(terrainGpu.canvas/);
  assert.match(source,/uploadedBackgroundRef.current !== skyComputation.pixels/);
  assert.doesNotMatch(source,/starsOnGpu = .*showBenchmarkLabels/);
  assert.match(source,/drawObservedStarLabels\(context/);
});
