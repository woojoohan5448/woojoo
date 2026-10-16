import type { Account, ProductLine, ProductRevenuePoint } from '../types'

/**
 * EXTENSION POINT (§11) — intentionally NOT implemented in this phase.
 * Future: clicking a chart point shows LG U+ revenue by product line for the account.
 * Data contract: ProductRevenuePoint[] (types.ts) supplied by an internal revenue feed,
 * with multi-carrier / dual-network capture constraints per product. No allocation is computed here.
 */
export const PRODUCT_LINES: ProductLine[] = ['CLOUD', 'SI_BUILD', 'AX_PROJECT', 'AI_INFRA_AIDC_GPUAAS', 'SECURITY', 'CONNECTIVITY', 'OTHER']

export interface ProductRevenueProvider { (accountId: string, year: 2026 | 2031): Promise<ProductRevenuePoint[] | null> }

export default function ProductRevenueDrilldown({ account }: { account: Account; provider?: ProductRevenueProvider }) {
  return (
    <section className="card border-dashed p-4 opacity-80" aria-disabled>
      <div className="kicker">후속 버전 · 확장 포인트</div>
      <h3 className="text-[14px] font-bold">IT Product Revenue Drilldown — {account.original_name}</h3>
      <p className="mt-1 text-[12px] text-ink3">상품별 LG U+ 매출({PRODUCT_LINES.join(' · ')})과 상품별 Capture Rate·통신 3사 점유율은 이번 단계에서 추정·배분하지 않습니다(검증되지 않은 제품 매출의 강제 배분 금지). 사내 상품 매출 피드가 연결되면 이 영역에 막대그래프가 표시됩니다.</p>
    </section>
  )
}
