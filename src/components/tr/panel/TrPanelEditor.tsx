"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Info } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { TrPanelLink as Link } from "@/components/tr/panel/TrPanelLink";
import { TrPanelBusySpinner } from "@/components/tr/panel/TrPanelMotion";
import { useSaveShortcut } from "@/components/tr/panel/useSaveShortcut";
import { activeSectionIndex } from "@/lib/tr/panel/editorScrollSpy";

/**
 * The full-screen editor page every "create / edit one thing" flow uses.
 *
 *   <TrPanelEditor backHref parentLabel title subject>
 *     <TrPanelEditorActions>…top-bar buttons or a save indicator…</TrPanelEditorActions>
 *     <TrPanelEditorTabs tabs={TABS} />
 *     <TrPanelEditorCard id="…" title="…">…fields…</TrPanelEditorCard>
 *   </TrPanelEditor>
 *
 * The shell drops its sidebar on editor routes (`isPanelEditorRoute`), so this
 * owns the whole screen: a dark top bar with the way back, then a centred column.
 * Tabs and cards are optional — a wizard can put anything in the column.
 */

const ActionsSlotContext = createContext<HTMLElement | null>(null);

export function TrPanelEditor({
  backHref,
  parentLabel,
  title,
  subject,
  badges,
  width = "default",
  children,
}: {
  backHref: string;
  /** Name of the list this editor belongs to — the first crumb, and the back target. */
  parentLabel: string;
  /** What this page is, e.g. "Ürünü düzenle". */
  title: string;
  /** The thing being edited, shown centred in the bar on wide screens. */
  subject?: string | null;
  /** Small status chips shown right after the title (hidden on phones). */
  badges?: ReactNode;
  /** "wide" gives pages that need a side column room for it. */
  width?: "default" | "wide";
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <div className="min-h-dvh bg-[color:var(--panel-canvas,#F2F3F5)]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[color:var(--panel-shell,#1C1C1E)] px-3 text-white sm:px-4 lg:h-16 lg:px-6">
        <Link
          href={backHref}
          aria-label={`${parentLabel} sayfasına dön`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 motion-reduce:transition-none"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </Link>

        <nav
          aria-label="Konum"
          className="flex min-w-0 items-center gap-2 text-[15px] lg:text-[17px]"
        >
          <Link
            href={backHref}
            className="hidden shrink-0 text-white/60 transition-colors duration-150 hover:text-white sm:inline motion-reduce:transition-none"
          >
            {parentLabel}
          </Link>
          <ChevronRight
            className="hidden h-4 w-4 shrink-0 text-white/35 sm:block"
            aria-hidden
          />
          <h1 className="min-w-0 truncate font-semibold">{title}</h1>
          {badges ? (
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              {badges}
            </div>
          ) : null}
        </nav>

        {subject ? (
          <p className="pointer-events-none absolute left-1/2 hidden max-w-[32%] -translate-x-1/2 truncate text-[15px] font-medium text-white/85 xl:block">
            {subject}
          </p>
        ) : null}

        <div
          ref={setSlot}
          className="ml-auto flex shrink-0 items-center gap-2 text-[13px]"
        />
      </header>

      <ActionsSlotContext.Provider value={slot}>
        <main
          className={`mx-auto w-full px-4 pt-3 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-5 lg:pt-4 ${
            width === "wide" ? "max-w-6xl" : "max-w-4xl"
          }`}
        >
          {children}
        </main>
      </ActionsSlotContext.Provider>
    </div>
  );
}

/** Renders into the right-hand end of the top bar, from anywhere inside the editor. */
export function TrPanelEditorActions({ children }: { children: ReactNode }) {
  const slot = useContext(ActionsSlotContext);
  return slot ? createPortal(children, slot) : null;
}

/**
 * The save controls every editor's top bar shares: a status line and **Kaydet**,
 * with Ctrl/Cmd+S. Pair it with `useUnsavedChangesGuard` so leaving with edits asks
 * first. Forms save manually — there is no autosave (see the panel's save model).
 *
 * - `dirty`: the form differs from what was last saved.
 * - `requireDirty`: an existing item can't be saved until something changed; a new
 *   one can always be submitted.
 * - `saved`: show "Kaydedildi" while clean (after a successful save).
 */
export function TrPanelEditorSave({
  dirty,
  saving,
  saved = false,
  requireDirty = false,
  disabled = false,
  onSave,
  label = "Kaydet",
}: {
  dirty: boolean;
  saving: boolean;
  saved?: boolean;
  requireDirty?: boolean;
  /** Extra reasons not to save right now (an upload is running, …). */
  disabled?: boolean;
  onSave: () => void;
  label?: string;
}) {
  const canSave = !saving && !disabled && (!requireDirty || dirty);
  useSaveShortcut(onSave, canSave);

  return (
    <TrPanelEditorActions>
      {saving ? (
        <span
          className="hidden items-center gap-2 text-[13.5px] text-white/70 sm:inline-flex"
          role="status"
        >
          <TrPanelBusySpinner />
          Kaydediliyor…
        </span>
      ) : dirty ? (
        <span
          className="hidden items-center gap-2 text-[13.5px] font-medium text-amber-300 sm:inline-flex"
          role="status"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden />
          Kaydedilmemiş değişiklikler
        </span>
      ) : saved ? (
        <span
          className="hidden items-center gap-1.5 text-[13.5px] text-emerald-300 sm:inline-flex"
          role="status"
        >
          <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
          Kaydedildi
        </span>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="inline-flex h-10 items-center rounded-lg bg-[color:var(--panel-accent)] px-7 text-[14px] font-semibold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-[color:var(--panel-accent-hover)] hover:shadow active:scale-[0.98] active:bg-[color:var(--panel-accent-active)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none lg:h-11 lg:px-9 lg:text-[15px] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {label}
      </button>
    </TrPanelEditorActions>
  );
}

export interface TrPanelEditorTab {
  /** DOM id of the card the tab jumps to. */
  id: string;
  label: string;
}

/**
 * Sticky section tabs. Clicking one scrolls to its card; scrolling the page moves
 * the underline. A card without a tab belongs to the tab above it.
 */
export function TrPanelEditorTabs({
  tabs,
}: {
  tabs: readonly TrPanelEditorTab[];
}) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (lockRef.current) return;
      // Each top is measured from where a tab click parks the card (its
      // scroll-margin-top), so a section is current the moment a click lands on it.
      const tops = tabs.map((tab) => {
        const card = document.getElementById(tab.id);
        if (!card) return Number.POSITIVE_INFINITY;
        const margin = parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
        return card.getBoundingClientRect().top - margin;
      });
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2;
      setActive(activeSectionIndex(tops, 4, atBottom));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [tabs]);

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  // Keep the current tab in view when the row scrolls sideways on a phone.
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.children[active] as HTMLElement | undefined;
    if (!list || !tab) return;
    list.scrollTo({
      left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  const jump = (index: number) => {
    const target = document.getElementById(tabs[index]?.id ?? "");
    if (!target) return;
    setActive(index);
    // Hold the clicked tab while the smooth scroll passes the ones in between.
    lockRef.current = true;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockRef.current = false;
    }, 700);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div
      className="sticky top-14 z-20 -mx-4 bg-[color:var(--panel-canvas,#F2F3F5)] px-4 sm:-mx-5 sm:px-5 lg:top-16"
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label="Bölümler"
        className="flex gap-6 overflow-x-auto border-b border-neutral-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, index) => {
          const current = index === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={current}
              onClick={() => jump(index)}
              className={`relative h-12 shrink-0 text-[14px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--panel-accent-deep)] motion-reduce:transition-none ${
                current
                  ? "text-[color:var(--panel-accent-deep)]"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab.label}
              {current ? (
                <motion.span
                  layoutId="panel-editor-tab"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[color:var(--panel-accent)]"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One titled card in the editor column. Give it an `id` to make it a tab target. */
export function TrPanelEditorCard({
  id,
  title,
  hint,
  tone = "default",
  allowOverflow = false,
  children,
}: {
  id: string;
  title: string;
  /** Short explanation shown from the (i) next to the title. */
  hint?: string;
  tone?: "default" | "danger";
  /** Let dropdowns inside the card extend past its bottom edge (suggestion lists); sideways it still clips. */
  allowOverflow?: boolean;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`scroll-mt-32 rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        allowOverflow ? "overflow-x-clip" : "overflow-hidden"
      } ${tone === "danger" ? "border-red-200" : "border-neutral-200/80"}`}
    >
      <header className="flex items-center gap-2 border-b border-neutral-200/80 px-4 py-3.5 sm:px-6 sm:py-4">
        <h2
          id={titleId}
          className={`text-[16px] font-semibold sm:text-[17px] ${
            tone === "danger" ? "text-red-800" : "text-neutral-900"
          }`}
        >
          {title}
        </h2>
        {hint ? <TrPanelInfoTip text={hint} /> : null}
      </header>
      <div className="space-y-6 p-4 sm:p-6">{children}</div>
    </section>
  );
}

/** The (i) next to a card title, with its hint on hover / focus. */
export function TrPanelInfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="grid h-5 w-5 place-items-center rounded-full text-neutral-400 transition-colors duration-150 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--panel-accent-deep)] motion-reduce:transition-none"
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-10 mt-1.5 w-max max-w-[260px] rounded-md bg-neutral-900 px-2.5 py-1.5 text-[12px] leading-snug font-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
      >
        {text}
      </span>
    </span>
  );
}
