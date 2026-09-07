import type { CapabilityEvaluation } from "../science/contracts.ts";

export type ProviderState<T> =
  | {
      status: "ready";
      provenanceId: string;
      capability: CapabilityEvaluation;
      value: T;
    }
  | {
      status: "unavailable";
      provenanceId: string;
      reason: string;
      requiredArtifact: string;
    };

export class PhysicsDataUnavailableError extends Error {
  readonly provenanceId: string;
  readonly requiredArtifact: string;

  constructor(provenanceId: string, reason: string, requiredArtifact: string) {
    super(reason);
    this.name = "PhysicsDataUnavailableError";
    this.provenanceId = provenanceId;
    this.requiredArtifact = requiredArtifact;
  }
}

export function requireProviderValue<T>(provider: ProviderState<T>): T {
  if (provider.status === "unavailable") {
    throw new PhysicsDataUnavailableError(
      provider.provenanceId,
      provider.reason,
      provider.requiredArtifact,
    );
  }
  if (
    provider.capability.state !== "validated" ||
    provider.capability.artifactId === null ||
    provider.capability.validationReceiptIds.length === 0
  ) {
    throw new PhysicsDataUnavailableError(
      provider.provenanceId,
      "The provider value is not backed by a validated artifact and receipt chain.",
      provider.capability.artifactId ?? "validated-scientific-artifact",
    );
  }
  return provider.value;
}
