"use client";

import { useLanguage } from "./language-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();

  const optionClassName = (selected: boolean) =>
    [
      "rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3559e8]/30",
      compact ? "px-0.5 py-1 text-[9px]" : "flex-1 px-2 py-1 text-[11px]",
      selected
        ? "bg-white text-[#3559e8] shadow-sm"
        : "text-[#7e8798] hover:text-[#465268]",
    ].join(" ");

  return (
    <div
      aria-label={t("language.selector")}
      className={[
        "flex items-center rounded-lg border border-[#e3e7ee] bg-[#f7f8fa]",
        compact
          ? "mx-auto w-10 justify-center gap-px px-0.5 lg:h-[30px] lg:w-11 lg:gap-0 lg:px-0 lg:whitespace-nowrap"
          : "h-9 w-full gap-1 p-1 lg:h-[var(--control-height)]",
      ].join(" ")}
      role="group"
    >
      <button
        type="button"
        aria-label={t("language.switchToChinese")}
        aria-pressed={language === "zh"}
        className={optionClassName(language === "zh")}
        onClick={() => setLanguage("zh")}
      >
        中文
      </button>
      <span aria-hidden="true" className={compact ? "text-[10px] text-[#b7bec9] lg:hidden" : "text-[10px] text-[#b7bec9]"}>
        /
      </span>
      <button
        type="button"
        aria-label={t("language.switchToEnglish")}
        aria-pressed={language === "en"}
        className={optionClassName(language === "en")}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
