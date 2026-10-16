import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, CustomChart, ScatterChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, DataZoomComponent, TitleComponent, AriaComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([BarChart, CustomChart, ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, LabelLayout, DataZoomComponent, TitleComponent, AriaComponent, SVGRenderer])

export type EOption = echarts.EChartsCoreOption

interface Props {
  option: EOption
  height: number | string
  onClick?: (p: any) => void
  ariaLabel: string
  themeKey?: string
}

/** Thin ECharts wrapper: SVG renderer (crisp on meeting-room displays), resize-aware, click passthrough. */
export default function EChart({ option, height, onClick, ariaLabel, themeKey }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    if (!el.current) return
    chart.current = echarts.init(el.current, undefined, { renderer: 'svg' })
    chart.current.on('click', (p: any) => clickRef.current?.(p))
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null }
  }, [])

  useEffect(() => { chart.current?.setOption(option, { notMerge: true }) }, [option, themeKey])

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ height, width: '100%' }} />
}
