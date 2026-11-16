"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Part = { width: number; color: string; phase: 1 | 2 | 3 };
const rows: { label: string; amount: string; width: number; parts: Part[] }[] = [
  { label: "상품 상세", amount: "29,000원", width: 88, parts: [{ width: 100, color: "var(--price-base)", phase: 1 }] },
  { label: "장바구니", amount: "30,500원", width: 92, parts: [{ width: 95, color: "var(--price-base)", phase: 1 }, { width: 5, color: "var(--risk)", phase: 2 }] },
  { label: "주문서", amount: "33,000원", width: 100, parts: [{ width: 88, color: "var(--price-base)", phase: 1 }, { width: 4.5, color: "var(--risk)", phase: 2 }, { width: 7.5, color: "var(--review)", phase: 3 }] },
];

/**
 * Stage-by-stage amounts. When the chart scrolls into view it grows in three beats:
 * the product price on all rows together, then the preselected option on cart and checkout,
 * then the new required fee on checkout. Each row's amount appears when its last part lands.
 */
export function PriceBars() {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setPlay(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp-result__bars">
      <span style={{ fontSize: 16, fontWeight: 700 }}>단계별로 보이는 금액</span>
      <div
        ref={ref}
        className="bars price-bars"
        data-play={play}
        role="img"
        aria-label="단계별 금액: 상품 상세 29,000원, 장바구니 30,500원(미리 선택된 파손 보장 1,500원 포함), 주문서 33,000원(필수 처리비 2,500원 새로 붙음)"
      >
        {rows.map((row) => {
          const last = Math.max(...row.parts.map((part) => part.phase));
          return (
            <div key={row.label} className="bars__row">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{row.label}</span>
              <span className="bars__track" style={{ width: `${row.width}%` }}>
                {row.parts.map((part, index) => (
                  <span key={index} className={`price-bars__part price-bars__part--${part.phase}`} style={{ width: `${part.width}%`, background: part.color }} />
                ))}
              </span>
              <span className={`tnum price-bars__amount price-bars__amount--${last}`} style={{ fontSize: 16, fontWeight: 700, textAlign: "right" } as CSSProperties}>{row.amount}</span>
            </div>
          );
        })}
      </div>
      <div className="legend price-bars__legend">
        <span><i style={{ background: "var(--price-base)" }} />상품 금액</span>
        <span><i style={{ background: "var(--risk)" }} />미리 선택된 옵션 +1,500원</span>
        <span><i style={{ background: "var(--review)" }} />새로 붙은 필수 처리비 +2,500원</span>
      </div>
    </div>
  );
}
