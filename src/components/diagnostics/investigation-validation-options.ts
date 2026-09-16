import type { DiagnosticCase } from "@/lib/diagnostics/types";
import type { InvestigationResult } from "@/lib/investigations/types";

export type InvestigationValidationOption = {
  id: string;
  label: string;
  description: string;
  priority: "primary" | "supporting";
};

export function getInvestigationValidationOptions(
  diagnosticCase: DiagnosticCase,
  result: InvestigationResult,
): InvestigationValidationOption[] {
  return result.recommendedValidations
    .map((recommendation, index) => ({ recommendation, index }))
    .sort((left, right) => {
      const priorityDifference =
        Number(left.recommendation.priority !== "primary") -
        Number(right.recommendation.priority !== "primary");

      return priorityDifference || left.index - right.index;
    })
    .flatMap(({ recommendation }) => {
      const validation = diagnosticCase.nextValidations.find(
        (item) => item.id === recommendation.validationId,
      );

      return validation
        ? [
            {
              id: validation.id,
              label: validation.label,
              description: validation.description,
              priority: recommendation.priority,
            },
          ]
        : [];
    });
}
