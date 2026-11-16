"use client";

import { Icon } from "@/components/ui/Icon";
import { Mark, plainLabels, resultLabels, VerdictBadge, type ResultKind } from "@/components/ui/Status";
import { kindOrder } from "./ResultRing";
import type { ReportItem } from "./model";

export type ListFilter = "all" | ResultKind;
const tabOrder: ResultKind[] = ["risk", "review", "none", "clear"];

/**
 * The 16 checks grouped by result (wireframe R-01): filter tabs, group header = verdict badge
 * + plain name, colored rule on the left, one row per check. 괜찮아요 starts collapsed.
 */
export function TypeList({ items, filter, onFilter, selected, onSelect, clearOpen, onClearOpen }: {
  items: ReportItem[];
  filter: ListFilter;
  onFilter: (filter: ListFilter) => void;
  selected?: string;
  onSelect: (item: ReportItem) => void;
  clearOpen: boolean;
  onClearOpen: (open: boolean) => void;
}) {
  const count = (kind: ResultKind) => items.filter((item) => item.kind === kind).length;
  const groups = kindOrder.filter((kind) => (filter === "all" || filter === kind) && count(kind));

  return (
    <div className="rv-list" id="rv-list">
      <div className="rv-tabs" role="toolbar" aria-label="결과로 거르기">
        <button type="button" className="rv-tab" aria-pressed={filter === "all"} onClick={() => onFilter("all")}>
          전체 <span className="tnum">{items.length}</span>
        </button>
        {tabOrder.map((kind) => (
          <button key={kind} type="button" className="rv-tab" aria-pressed={filter === kind} onClick={() => onFilter(kind)} disabled={!count(kind)}>
            <Mark kind={kind} />{resultLabels[kind]} <span className="tnum">{count(kind)}</span>
          </button>
        ))}
      </div>

      {groups.map((kind) => {
        const rows = items.filter((item) => item.kind === kind);
        const collapsible = kind === "clear" && filter === "all";
        const open = !collapsible || clearOpen;
        const headId = `rv-group-${kind}`;
        return (
          <section key={kind} aria-labelledby={headId} className={`rv-group rv-group--${kind}`}>
            {collapsible ? (
              <button type="button" className="rv-group__head rv-group__head--toggle" aria-expanded={open} aria-controls={`${headId}-rows`} onClick={() => onClearOpen(!open)}>
                <span id={headId} className="rv-group__title"><VerdictBadge kind={kind} />{plainLabels[kind]}</span>
                <span className="rv-group__hint">{rows.length}곳 · {open ? "접기" : "눌러서 보기"}<Icon name="down" size={14} className={open ? "rv-flip" : undefined} /></span>
              </button>
            ) : (
              <h3 id={headId} className="rv-group__head"><span className="rv-group__title"><VerdictBadge kind={kind} />{plainLabels[kind]}</span></h3>
            )}
            {open ? (
              <ul id={`${headId}-rows`} className="rv-rows">
                {rows.map((item) => (
                  <li key={item.type}>
                    <button
                      type="button"
                      className="rv-row"
                      data-type={item.type}
                      aria-current={selected === item.type ? "true" : undefined}
                      onClick={() => onSelect(item)}
                    >
                      <span className="rv-row__no tnum">{item.no}</span>
                      <span className="rv-row__text">
                        <span className="rv-row__title">
                          {item.plain}
                          {item.ai.length ? <span className="rv-ai-tag">AI 의견 있음</span> : null}
                        </span>
                        <span className="rv-row__summary">{item.summary}</span>
                      </span>
                      <Icon name="chevron" size={16} color="var(--ink-3)" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
