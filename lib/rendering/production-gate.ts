import { PhysicsDataUnavailableError } from "../physics/providers.ts";
import {
  mayUnlockRenderer,
  type CapabilityEvaluation,
  type RenderPrerequisite,
} from "../science/contracts.ts";

const missing = (reason: string): CapabilityEvaluation => ({
  state: "artifact-missing",
  artifactId: null,
  validationReceiptIds: [],
  reason,
});

export const productionCapabilityEvaluations: Record<
  RenderPrerequisite,
  CapabilityEvaluation
> = {
  "joint-potential": missing("联合引力势制品尚未完成质量去重、重拟合与验证。"),
  "phase-space": missing("全银河六维相空间制品尚未接入。"),
  "stellar-population": missing("恒星族群与光谱能量分布制品尚未接入。"),
  "dust-radiative-transfer": missing("全银河三维尘埃后验与波长消光制品尚未接入。"),
  "unresolved-radiance": missing("未分辨恒星的光谱辐亮度与通量守恒制品尚未接入。"),
  "light-cone-transform": missing("光行时、像差和多普勒观测变换制品尚未接入。"),
  "observer-response": missing("人眼和相机响应制品尚未接入。"),
};

export const productionRenderBlockers = Object.values(
  productionCapabilityEvaluations,
).map((evaluation) => evaluation.reason);

export class ProductionRendererLockedError extends PhysicsDataUnavailableError {
  readonly blockers: readonly string[];

  constructor(blockers: readonly string[]) {
    super(
      "production-sky-renderer",
      "生产银河天空所需的科学制品或验证回执不完整。",
      "closed-render-prerequisite-chain",
    );
    this.name = "ProductionRendererLockedError";
    this.blockers = blockers;
  }
}

export function requireProductionRendererUnlocked(): true {
  if (!mayUnlockRenderer(productionCapabilityEvaluations)) {
    throw new ProductionRendererLockedError(productionRenderBlockers);
  }
  return true;
}
