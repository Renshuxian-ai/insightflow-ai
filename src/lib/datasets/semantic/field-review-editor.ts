import {
  SEMANTIC_TYPE_IDS,
  semanticTypeRegistry,
} from "./semantic-type-registry";
import type { SemanticType } from "./types";

export type SemanticFieldEditState = {
  meaningChanged: boolean;
  descriptionChanged: boolean;
  isDirty: boolean;
  canSave: boolean;
  saveMode: "semantic-mapping" | "description-only" | "none";
};

function normalizeDescription(value: string): string {
  return value.trim();
}

export function getSemanticFieldEditState({
  initialSemanticType,
  currentSemanticType,
  initialDescription,
  currentDescription,
}: {
  initialSemanticType: SemanticType;
  currentSemanticType: SemanticType;
  initialDescription: string;
  currentDescription: string;
}): SemanticFieldEditState {
  const meaningChanged = currentSemanticType !== initialSemanticType;
  const descriptionChanged =
    normalizeDescription(currentDescription) !==
    normalizeDescription(initialDescription);
  const hasKnownMeaning =
    currentSemanticType !== SEMANTIC_TYPE_IDS.unknown &&
    semanticTypeRegistry[currentSemanticType] !== undefined;
  const canSaveSemanticMapping = hasKnownMeaning && (meaningChanged || descriptionChanged);
  const canSaveDescriptionOnly = !hasKnownMeaning && descriptionChanged;
  const saveMode = canSaveSemanticMapping
    ? "semantic-mapping"
    : canSaveDescriptionOnly
      ? "description-only"
      : "none";

  return {
    meaningChanged,
    descriptionChanged,
    isDirty: meaningChanged || descriptionChanged,
    canSave: saveMode !== "none",
    saveMode,
  };
}
