// Monochrome chart kit for the Djaber.ai reporting suite.
// Length/position encode magnitude — never color. Dark, RTL-safe, no chart lib.

export { StatTile, StatTileRow } from './StatTile';
export type { StatTileProps } from './StatTile';

export { BarList } from './BarList';
export type { BarListProps, BarListRow } from './BarList';

export { ColumnChart } from './ColumnChart';
export type { ColumnChartProps, ColumnPoint } from './ColumnChart';

export { LineChart } from './LineChart';
export type { LineChartProps, LinePoint, LineSeries } from './LineChart';

export { DonutChart } from './DonutChart';
export type { DonutChartProps, DonutSlice } from './DonutChart';

export { FunnelBars } from './FunnelBars';
export type { FunnelBarsProps, FunnelStage } from './FunnelBars';

export { ReportShell } from './ReportShell';
export type { ReportShellProps, ReportPeriod } from './ReportShell';

export { fmtDA, fmtNum, compact } from './format';
