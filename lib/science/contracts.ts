export type CapabilityState =
  | "declared"
  | "artifact-missing"
  | "loaded-unvalidated"
  | "validated"
  | "rejected";

export type ConstraintClass =
  | "direct-observation"
  | "dynamical-inference"
  | "model-assumption"
  | "numerical-method";

export interface CartesianFrameContract {
  id: string;
  origin: string;
  handedness: "right-handed";
  xAxis: string;
  yAxis: string;
  zAxis: string;
  referenceEpoch: string;
}

export interface ScientificArtifactContract {
  artifactId: string;
  schemaVersion: string;
  source: {
    title: string;
    url: string;
    version: string;
    codeCommit: string | null;
    license: string;
  };
  sha256: string;
  frame: CartesianFrameContract;
  units: Record<string, string>;
  validity: {
    spatialDomain: string;
    temporalDomain: string;
    extrapolationPolicy: "forbidden" | "explicit-model-ensemble";
  };
  uncertaintyVariantId: string;
  generationReceiptId: string;
  validationReceiptIds: string[];
}

export interface ValidationMetric {
  name: string;
  value: number;
  unit: string;
  acceptanceRule: string;
  passed: boolean;
}

export interface ValidationReceiptContract {
  receiptId: string;
  artifactId: string;
  createdAt: string;
  validatorVersion: string;
  validatorCodeCommit: string;
  inputSha256: string;
  dependencyArtifacts: Array<{ artifactId: string; sha256: string }>;
  referenceDatasets: Array<{ datasetId: string; version: string; sha256: string }>;
  selectionFunctionIds: string[];
  withheldValidationData: boolean;
  metrics: ValidationMetric[];
  overallStatus: "passed" | "failed";
}

export interface LoadedScientificArtifact {
  metadata: ScientificArtifactContract;
  loadedSha256: string;
}

export interface CapabilityEvaluation {
  state: CapabilityState;
  artifactId: string | null;
  validationReceiptIds: string[];
  reason: string;
}

export interface ValidationContext {
  dependencySha256ByArtifactId: ReadonlyMap<string, string>;
  referenceDatasetSha256ById: ReadonlyMap<string, string>;
}

const renderPrerequisites = [
  "joint-potential",
  "phase-space",
  "stellar-population",
  "dust-radiative-transfer",
  "unresolved-radiance",
  "light-cone-transform",
  "observer-response",
] as const;

export type RenderPrerequisite = (typeof renderPrerequisites)[number];

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function evaluateArtifactCapability(
  loaded: LoadedScientificArtifact | null,
  receipts: readonly ValidationReceiptContract[],
  context: ValidationContext = {
    dependencySha256ByArtifactId: new Map(),
    referenceDatasetSha256ById: new Map(),
  },
): CapabilityEvaluation {
  if (!loaded) {
    return {
      state: "artifact-missing",
      artifactId: null,
      validationReceiptIds: [],
      reason: "No immutable scientific artifact was loaded.",
    };
  }

  const { metadata, loadedSha256 } = loaded;
  if (
    !SHA256_PATTERN.test(metadata.sha256) ||
    !SHA256_PATTERN.test(loadedSha256) ||
    metadata.sha256 !== loadedSha256
  ) {
    return {
      state: "rejected",
      artifactId: metadata.artifactId,
      validationReceiptIds: [],
      reason: "The loaded bytes do not match the artifact SHA-256 digest.",
    };
  }

  if (metadata.validationReceiptIds.length === 0) {
    return {
      state: "loaded-unvalidated",
      artifactId: metadata.artifactId,
      validationReceiptIds: [],
      reason: "The artifact has no validation receipts.",
    };
  }

  const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const requiredReceipts = metadata.validationReceiptIds.map((receiptId) =>
    receiptById.get(receiptId),
  );
  const valid = requiredReceipts.every(
    (receipt) =>
      receipt !== undefined &&
      receipt.artifactId === metadata.artifactId &&
      receipt.inputSha256 === metadata.sha256 &&
      receipt.overallStatus === "passed" &&
      receipt.metrics.length > 0 &&
      receipt.metrics.every((metric) => metric.passed) &&
      receipt.dependencyArtifacts.every(
        (dependency) =>
          SHA256_PATTERN.test(dependency.sha256) &&
          context.dependencySha256ByArtifactId.get(dependency.artifactId) ===
            dependency.sha256,
      ) &&
      receipt.referenceDatasets.every(
        (dataset) =>
          SHA256_PATTERN.test(dataset.sha256) &&
          context.referenceDatasetSha256ById.get(dataset.datasetId) === dataset.sha256,
      ),
  );

  return {
    state: valid ? "validated" : "rejected",
    artifactId: metadata.artifactId,
    validationReceiptIds: valid ? [...metadata.validationReceiptIds] : [],
    reason: valid
      ? "Loaded bytes and every named validation receipt form a closed, passing chain."
      : "A validation receipt is missing, mismatched or contains a failed metric.",
  };
}

export function mayUnlockRenderer(
  evaluations: Record<RenderPrerequisite, CapabilityEvaluation>,
): boolean {
  return renderPrerequisites.every((name) => {
    const evaluation = evaluations[name];
    return (
      evaluation.state === "validated" &&
      evaluation.artifactId !== null &&
      evaluation.validationReceiptIds.length > 0
    );
  });
}
