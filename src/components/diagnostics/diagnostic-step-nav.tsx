"use client";

import { useEffect, useState } from "react";

const diagnosticSteps = [
  { label: "发现异常", targetId: "investigation-summary" },
  { label: "查看证据", targetId: "investigation-evidence-basis" },
  { label: "确定调查方向", targetId: "investigation-analysis-direction" },
  {
    label: "生成验证方案",
    targetId: "investigation-validation-plan-action",
  },
  {
    label: "查看结果",
    targetId: "investigation-validation-result",
    reserved: true,
  },
] as const;

type DiagnosticStepTargetId = (typeof diagnosticSteps)[number]["targetId"];

function areTargetSetsEqual(
  left: ReadonlySet<DiagnosticStepTargetId>,
  right: ReadonlySet<DiagnosticStepTargetId>,
) {
  return left.size === right.size && [...left].every((id) => right.has(id));
}

export function DiagnosticStepNav() {
  const [activeTargetId, setActiveTargetId] =
    useState<DiagnosticStepTargetId>("investigation-summary");
  const [availableTargetIds, setAvailableTargetIds] = useState<
    ReadonlySet<DiagnosticStepTargetId>
  >(new Set());

  useEffect(() => {
    function updateActiveStep() {
      const availableTargets = diagnosticSteps.flatMap((step) => {
        const element = document.getElementById(step.targetId);

        return element ? [{ id: step.targetId, element }] : [];
      });
      const nextAvailableTargetIds = new Set(
        availableTargets.map((target) => target.id),
      );

      setAvailableTargetIds((current) =>
        areTargetSetsEqual(current, nextAvailableTargetIds)
          ? current
          : nextAvailableTargetIds,
      );

      if (availableTargets.length === 0) {
        return;
      }

      const viewportAnchor = window.innerHeight * 0.32;
      let nextActiveTargetId = availableTargets[0].id;

      for (const target of availableTargets) {
        if (target.element.getBoundingClientRect().top <= viewportAnchor) {
          nextActiveTargetId = target.id;
        } else {
          break;
        }
      }

      setActiveTargetId((current) =>
        current === nextActiveTargetId ? current : nextActiveTargetId,
      );
    }

    const observedTargets = new Map<DiagnosticStepTargetId, HTMLElement>();
    const intersectionObserver = new IntersectionObserver(updateActiveStep, {
      root: null,
      rootMargin: "0px 0px -68% 0px",
      threshold: 0,
    });

    function syncObservedTargets() {
      const nextAvailableTargetIds = new Set<DiagnosticStepTargetId>();

      for (const step of diagnosticSteps) {
        const element = document.getElementById(step.targetId);
        const observedElement = observedTargets.get(step.targetId);

        if (element) {
          nextAvailableTargetIds.add(step.targetId);

          if (element !== observedElement) {
            if (observedElement) {
              intersectionObserver.unobserve(observedElement);
            }

            observedTargets.set(step.targetId, element);
            intersectionObserver.observe(element);
          }
        } else if (observedElement) {
          intersectionObserver.unobserve(observedElement);
          observedTargets.delete(step.targetId);
        }
      }

      setAvailableTargetIds((current) =>
        areTargetSetsEqual(current, nextAvailableTargetIds)
          ? current
          : nextAvailableTargetIds,
      );
      updateActiveStep();
    }

    const mutationObserver = new MutationObserver(syncObservedTargets);

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    syncObservedTargets();

    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  function scrollToStep(targetId: DiagnosticStepTargetId) {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const isValidationPlanAction =
      targetId === "investigation-validation-plan-action";

    target.scrollIntoView({
      behavior: "smooth",
      block: isValidationPlanAction ? "center" : "start",
    });
    setActiveTargetId(targetId);

    if (isValidationPlanAction) {
      window.setTimeout(() => {
        if (!document.body.contains(target)) {
          return;
        }

        target.animate(
          [
            { boxShadow: "0 0 0 0 rgba(53, 89, 232, 0)" },
            { boxShadow: "0 0 0 3px rgba(53, 89, 232, 0.18)" },
            { boxShadow: "0 0 0 0 rgba(53, 89, 232, 0)" },
          ],
          { duration: 900, easing: "ease-out" },
        );
      }, 300);
    }
  }

  const activeStepIndex = diagnosticSteps.findIndex(
    (step) => step.targetId === activeTargetId,
  );

  return (
    <aside className="fixed top-1/2 right-5 z-30 hidden w-44 -translate-y-1/2 xl:block">
      <nav aria-label="诊断流程导航">
        <ol className="space-y-1">
          {diagnosticSteps.map((step, index) => {
            const isAvailable = availableTargetIds.has(step.targetId);
            const isActive = isAvailable && activeTargetId === step.targetId;
            const isPast = isAvailable && index < activeStepIndex;

            return (
              <li
                key={step.targetId}
                className={`relative ${
                  index < diagnosticSteps.length - 1
                    ? "after:absolute after:top-1/2 after:left-[17.5px] after:h-[calc(100%+4px)] after:w-px after:content-['']"
                    : ""
                } ${
                  index < activeStepIndex
                    ? "after:bg-[#b9c6f2]"
                    : "after:bg-[#dfe3ea]"
                }`}
              >
                <button
                  type="button"
                  disabled={!isAvailable}
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => scrollToStep(step.targetId)}
                  className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-xs transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8298ef] ${
                    isActive
                      ? "bg-[#f2f5ff] font-semibold text-[#2949ca]"
                      : isPast
                        ? "font-medium text-[#465268] hover:bg-[#f7f8fc] hover:text-[#263247]"
                        : isAvailable
                          ? "font-medium text-[#667085] hover:bg-[#f7f8fc] hover:text-[#344056]"
                        : "cursor-default font-medium text-[#b0b7c4]"
                  }`}
                >
                  <span
                    className={`relative z-10 grid size-5 shrink-0 place-items-center rounded-full border transition-[border-color,background-color,box-shadow] duration-150 ${
                      isActive
                        ? "border-[#3559e8] bg-white shadow-[0_0_0_4px_rgba(53,89,232,0.10)]"
                        : isPast
                          ? "border-[#9fb0ec] bg-[#e8edff] group-hover:border-[#8298ef]"
                          : isAvailable
                            ? "border-[#b8c0cd] bg-white group-hover:border-[#8298ef]"
                            : "border-[#d3d8e1] bg-[#fafbfc]"
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`rounded-full transition-colors duration-150 ${
                        isActive
                          ? "size-2 bg-[#3559e8]"
                          : isPast
                            ? "size-1.5 bg-[#6079d8]"
                            : isAvailable
                              ? "size-1.5 bg-[#a5afbe] group-hover:bg-[#6079d8]"
                              : "size-1.5 bg-[#d3d8e1]"
                      }`}
                    />
                  </span>
                  <span className="leading-5">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
