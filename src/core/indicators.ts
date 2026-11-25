import { TemplateRowCustomConfig, ReportSession } from './types';

export interface IndicatorDefinition {
  id: string;
  label: string;
  sourceType: 'REV' | 'DISB' | 'GPMB' | 'COMPOSITE';
  fieldOrFormula: string;
  numeratorField?: string;
  denominatorField?: string;
  originalUnit: 'million_vnd' | 'vnd' | 'm2' | 'ratio' | 'percent_100' | 'text';
  displayUnit: 'billion_vnd' | 'million_vnd' | 'm2' | 'ha' | 'percent' | 'text' | 'pp';
  precision: number;
  aggregationPolicy:
    | 'DIRECT_UNIT_CONVERSION'
    | 'RATIO_OF_SUMS'
    | 'SUM_PROJECTS'
    | 'GPMB_RECORDED_AREA_RATIO'
    | 'MEAN_ABSOLUTE_PER_UNIT'
    | 'BENCHMARK_RATIO_OF_SUMS'
    | 'COMPARISON_RULE'
    | 'QC_PROJECT_M_CHECK_ONLY';
  benchmarkPolicy: string;
  datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE' | 'REQUIRES_CONFIRMATION_IF_MIXED';
  isQualityCheckOnly?: boolean;
  templateRowNumber?: number;
  defaultStt?: string;
}

export const DEFAULT_INDICATORS: Record<string, IndicatorDefinition> = {
  REV_BUDGET_Y: {
    id: 'REV_BUDGET_Y',
    label: 'Dự toán thu NSNN giao từng địa phương tại QĐ 5055',
    sourceType: 'REV',
    fieldOrFormula: 'annual_total_budget / 1000 (khi hiển thị tỷ đồng)',
    numeratorField: 'annual_total_budget',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'DIRECT_UNIT_CONVERSION',
    benchmarkPolicy: 'SUM(C) across available 113 localities',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 3,
    defaultStt: '1',
  },
  REV_REALIZED: {
    id: 'REV_REALIZED',
    label: 'Kết quả thu NSNN',
    sourceType: 'REV',
    fieldOrFormula: 'Tổng thu NSNN lũy kế (đọc theo tiêu đề nguồn; triệu đồng / 1000 khi hiển thị tỷ đồng)',
    numeratorField: 'actual_total_revenue',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'DIRECT_UNIT_CONVERSION',
    benchmarkPolicy: 'SUM(actual_total_revenue) theo phạm vi có dữ liệu',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  REV_BENCHMARK_RATE: {
    id: 'REV_BENCHMARK_RATE',
    label: 'Tỷ lệ thu NSNN trung bình của 114 địa phương (đến ngày 19/10/2026)',
    sourceType: 'REV',
    fieldOrFormula: 'SUM(actual_total_revenue) / SUM(annual_total_budget) * 100',
    numeratorField: 'actual_total_revenue',
    denominatorField: 'annual_total_budget',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'BENCHMARK_RATIO_OF_SUMS',
    benchmarkPolicy:
      'LOCALITIES_AVAILABLE_N (độ phủ thực lưu ở trace; nhãn báo cáo cố định 114 địa phương)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    defaultStt: '2',
  },
  REV_RATE_Y: {
    id: 'REV_RATE_Y',
    label: 'Tỷ lệ thu NSNN của từng địa phương so với dự toán (đến ngày 19/10/2026)',
    sourceType: 'REV',
    fieldOrFormula: 'actual_total_revenue / annual_total_budget * 100',
    numeratorField: 'actual_total_revenue',
    denominatorField: 'annual_total_budget',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(I) / SUM(C) (113 localities available)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 4,
    defaultStt: '2',
  },
  REV_RATE_P: {
    id: 'REV_RATE_P',
    label: 'Tỷ lệ tổng thu so với kế hoạch kỳ',
    sourceType: 'REV',
    fieldOrFormula: 'actual_total_revenue / period_total_plan * 100',
    numeratorField: 'actual_total_revenue',
    denominatorField: 'period_total_plan',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(I) / SUM(F) (113 localities available)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  REV_LAND_RATE_Y: {
    id: 'REV_LAND_RATE_Y',
    label: 'Trong đó: tỷ lệ thu tiền sử dụng đất (so dự toán năm)',
    sourceType: 'REV',
    fieldOrFormula: 'actual_land_revenue / annual_land_budget * 100',
    numeratorField: 'actual_land_revenue',
    denominatorField: 'annual_land_budget',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(actual_land_revenue) / SUM(annual_land_budget), gồm mẫu số 0 (R04)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 5,
    defaultStt: '',
  },
  REV_LAND_RATE_P: {
    id: 'REV_LAND_RATE_P',
    label: 'Tỷ lệ thu tiền sử dụng đất so với kế hoạch kỳ',
    sourceType: 'REV',
    fieldOrFormula: 'actual_land_revenue / period_land_plan * 100',
    numeratorField: 'actual_land_revenue',
    denominatorField: 'period_land_plan',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(actual_land_revenue) / SUM(period_land_plan), gồm mẫu số 0 (R04)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  REV_NONLAND_RATE_Y: {
    id: 'REV_NONLAND_RATE_Y',
    label: 'Tỷ lệ thu không gồm tiền sử dụng đất (so dự toán năm)',
    sourceType: 'REV',
    fieldOrFormula: 'actual_nonland_revenue / annual_nonland_budget * 100',
    numeratorField: 'actual_nonland_revenue',
    denominatorField: 'annual_nonland_budget',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(actual_nonland_revenue) / SUM(annual_nonland_budget)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 6,
    defaultStt: '',
  },
  REV_NONLAND_RATE_P: {
    id: 'REV_NONLAND_RATE_P',
    label: 'Tỷ lệ thu không gồm đất so với kế hoạch kỳ',
    sourceType: 'REV',
    fieldOrFormula: 'actual_nonland_revenue / period_nonland_plan * 100',
    numeratorField: 'actual_nonland_revenue',
    denominatorField: 'period_nonland_plan',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(actual_nonland_revenue) / SUM(period_nonland_plan)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  DISB_PLAN: {
    id: 'DISB_PLAN',
    label: 'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung',
    sourceType: 'DISB',
    fieldOrFormula: 'F / 1000',
    numeratorField: 'adjusted_total_plan',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'DIRECT_UNIT_CONVERSION',
    benchmarkPolicy: 'SUM(F) / 114',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 7,
    defaultStt: '3',
  },
  DISB_PLAN_PER_UNIT: {
    id: 'DISB_PLAN_PER_UNIT',
    label: 'Vốn giao bình quân mỗi địa phương (114 địa phương)',
    sourceType: 'DISB',
    fieldOrFormula: 'SUM(F_114) / 114',
    numeratorField: 'adjusted_total_plan',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'MEAN_ABSOLUTE_PER_UNIT',
    benchmarkPolicy: 'SUM(F13:F126) / 114',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  DISB_PLAN_VS_AVG_COMMENT: {
    id: 'DISB_PLAN_VS_AVG_COMMENT',
    label: 'So với mức vốn giao bình quân một địa phương (136,41 tỷ đồng)',
    sourceType: 'DISB',
    fieldOrFormula: 'COMPARE(F_i, SUM(F_114)/114)',
    numeratorField: 'adjusted_total_plan',
    originalUnit: 'text',
    displayUnit: 'text',
    precision: 2,
    aggregationPolicy: 'COMPARISON_RULE',
    benchmarkPolicy: 'Compare locality F with SUM(F13:F126)/114',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 8,
    defaultStt: '',
  },
  DISB_BENCHMARK_RATE: {
    id: 'DISB_BENCHMARK_RATE',
    label: 'Tỷ lệ giải ngân trung bình của 114 địa phương (đến ngày 15/10/2026)',
    sourceType: 'DISB',
    fieldOrFormula: 'SUM(I13:I126) / SUM(F13:F126) * 100',
    numeratorField: 'disbursed_total',
    denominatorField: 'adjusted_total_plan',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'BENCHMARK_RATIO_OF_SUMS',
    benchmarkPolicy: 'LOCALITIES_FULL_114: SUM(I)/SUM(F) = 67,10%',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 9,
    defaultStt: '4',
  },
  DISB_PAID: {
    id: 'DISB_PAID',
    label: 'Đã giải ngân đầu tư công',
    sourceType: 'DISB',
    fieldOrFormula: 'I / 1000',
    numeratorField: 'disbursed_total',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'DIRECT_UNIT_CONVERSION',
    benchmarkPolicy: 'SUM(I)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  DISB_RATE: {
    id: 'DISB_RATE',
    label: 'Tỷ lệ giải ngân của từng địa phương',
    sourceType: 'DISB',
    fieldOrFormula: '(I / F) * 100',
    numeratorField: 'disbursed_total',
    denominatorField: 'adjusted_total_plan',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'Compare with DISB_BENCHMARK_RATE (67,10%)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 10,
    defaultStt: '',
  },
  DISB_GPMB_PAID: {
    id: 'DISB_GPMB_PAID',
    label: 'Giải ngân bồi thường/GPMB (nguồn giải ngân)',
    sourceType: 'DISB',
    fieldOrFormula: 'M / 1000',
    numeratorField: 'disbursed_gpmb',
    originalUnit: 'million_vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'DIRECT_UNIT_CONVERSION',
    benchmarkPolicy: 'SUM(M present)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  DISB_COMPARISON_LABEL: {
    id: 'DISB_COMPARISON_LABEL',
    label: 'Kết quả giải ngân so với tỷ lệ trung bình',
    sourceType: 'DISB',
    fieldOrFormula: 'COMPARE(DISB_RATE_i, DISB_BENCHMARK_RATE)',
    numeratorField: 'disbursed_total',
    denominatorField: 'adjusted_total_plan',
    originalUnit: 'text',
    displayUnit: 'text',
    precision: 2,
    aggregationPolicy: 'COMPARISON_RULE',
    benchmarkPolicy: 'Compare locality I/F with SUM(I13:I126)/SUM(F13:F126)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 11,
    defaultStt: '',
  },
  GPMB_BUDGET: {
    id: 'GPMB_BUDGET',
    label: 'Kinh phí phân bổ GPMB cho từng địa phương',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(G_project) / 1e9',
    numeratorField: 'gpmb_allocated_budget',
    originalUnit: 'vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'SUM_PROJECTS',
    benchmarkPolicy: 'SUM(G) across 108 localities with project records',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 12,
    defaultStt: '5',
  },
  GPMB_PAID: {
    id: 'GPMB_PAID',
    label: 'Kinh phí đã chi GPMB',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(J_project) / 1e9',
    numeratorField: 'gpmb_paid_amount',
    originalUnit: 'vnd',
    displayUnit: 'billion_vnd',
    precision: 2,
    aggregationPolicy: 'SUM_PROJECTS',
    benchmarkPolicy: 'SUM(J) across 108 localities',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  GPMB_BUDGET_RATE: {
    id: 'GPMB_BUDGET_RATE',
    label: 'Tỷ lệ chi GPMB so với kinh phí phân bổ',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(J_project) / SUM(G_project) * 100',
    numeratorField: 'gpmb_paid_amount',
    denominatorField: 'gpmb_allocated_budget',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'RATIO_OF_SUMS',
    benchmarkPolicy: 'SUM(J) / SUM(G)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  GPMB_AREA_PLAN: {
    id: 'GPMB_AREA_PLAN',
    label: 'Diện tích phải GPMB của từng địa phương',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(D_project)',
    numeratorField: 'gpmb_declared_area',
    originalUnit: 'm2',
    displayUnit: 'm2',
    precision: 0,
    aggregationPolicy: 'SUM_PROJECTS',
    benchmarkPolicy: 'SUM(D) across 422 project rows (108 localities)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 13,
    defaultStt: '6',
  },
  GPMB_AREA_DONE: {
    id: 'GPMB_AREA_DONE',
    label: 'Diện tích đã GPMB (đã ghi nhận)',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(I_project_recorded)',
    numeratorField: 'gpmb_recorded_area',
    originalUnit: 'm2',
    displayUnit: 'm2',
    precision: 0,
    aggregationPolicy: 'SUM_PROJECTS',
    benchmarkPolicy: 'SUM(I recorded) across 422 project rows',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
  },
  GPMB_BENCHMARK_AREA_RATE: {
    id: 'GPMB_BENCHMARK_AREA_RATE',
    label: 'Tỷ lệ GPMB trung bình của 114 địa phương (đến ngày 26/10/2026)',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(I_422_projects_recorded) / SUM(D_422_projects) * 100',
    numeratorField: 'gpmb_recorded_area',
    denominatorField: 'gpmb_declared_area',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'BENCHMARK_RATIO_OF_SUMS',
    benchmarkPolicy:
      'LOCALITIES_AVAILABLE_N (108/114 địa bàn, 422 dự án): SUM(I)/SUM(D) = 72,13% PARTIAL_AGGREGATE (không ghi 70,8% của 114)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 14,
    defaultStt: '7',
  },
  GPMB_AREA_RATE: {
    id: 'GPMB_AREA_RATE',
    label: 'Tỷ lệ GPMB của từng địa phương',
    sourceType: 'GPMB',
    fieldOrFormula: 'SUM(I_project_recorded) / SUM(D_project) * 100',
    numeratorField: 'gpmb_recorded_area',
    denominatorField: 'gpmb_declared_area',
    originalUnit: 'ratio',
    displayUnit: 'percent',
    precision: 2,
    aggregationPolicy: 'GPMB_RECORDED_AREA_RATIO',
    benchmarkPolicy:
      'Phương pháp DUY NHẤT: SUM(I)/SUM(D) theo diện tích; không dùng bình quân tỷ lệ dự án M (R06)',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 15,
    defaultStt: '',
  },
  GPMB_COMPARISON_LABEL: {
    id: 'GPMB_COMPARISON_LABEL',
    label: 'Kết quả GPMB so với tỷ lệ trung bình',
    sourceType: 'GPMB',
    fieldOrFormula: 'COMPARE(GPMB_AREA_RATE_i, GPMB_BENCHMARK_AREA_RATE)',
    numeratorField: 'gpmb_recorded_area',
    denominatorField: 'gpmb_declared_area',
    originalUnit: 'text',
    displayUnit: 'text',
    precision: 2,
    aggregationPolicy: 'COMPARISON_RULE',
    benchmarkPolicy:
      'Yêu cầu xác nhận khi so với mốc 108/114 PARTIAL_AGGREGATE; không tự kết luận nếu thiếu thành phần hoặc chưa phê duyệt',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 16,
    defaultStt: '',
  },
  GPMB_UNCOMPLETED_PROJECTS_COUNT: {
    id: 'GPMB_UNCOMPLETED_PROJECTS_COUNT',
    label: 'Số dự án GPMB chưa hoàn thành',
    sourceType: 'GPMB',
    fieldOrFormula: 'COUNT_UNCOMPLETED(GPMB)',
    originalUnit: 'text',
    displayUnit: 'text',
    precision: 0,
    aggregationPolicy: 'SUM_PROJECTS',
    benchmarkPolicy: 'Thống kê số lượng dự án có tỷ lệ GPMB < 100%',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    templateRowNumber: 17,
    defaultStt: '',
  },
  GPMB_M_SOURCE_MISMATCH: {
    id: 'GPMB_M_SOURCE_MISMATCH',
    label: 'Cờ sai khác tỷ lệ M nguồn theo từng dòng dự án',
    sourceType: 'GPMB',
    fieldOrFormula: 'M_project - (100 * I_project / D_project)',
    numeratorField: 'gpmb_recorded_area',
    denominatorField: 'gpmb_declared_area',
    originalUnit: 'percent_100',
    displayUnit: 'pp',
    precision: 2,
    aggregationPolicy: 'QC_PROJECT_M_CHECK_ONLY',
    benchmarkPolicy: 'Chỉ kiểm tra chất lượng ở cấp dòng dự án (ngưỡng > 0,1 điểm %), không hiển thị làm chỉ tiêu báo cáo',
    datePolicy: 'STRICT_SAME_DATASET_AS_OF_DATE',
    isQualityCheckOnly: true,
  },
};

export const TEMPLATE_14_ROWS_DEFAULT: TemplateRowCustomConfig[] = [
  {
    rowNumber: 3,
    indicatorId: 'REV_BUDGET_Y',
    sttLabel: '1',
    customLabel: 'Dự toán thu NSNN giao từng địa phương tại QĐ 5055',
    groupName: 'I. Thu ngân sách nhà nước',
    visible: true,
    order: 1,
  },
  {
    rowNumber: 4,
    indicatorId: 'REV_RATE_Y',
    sttLabel: '2',
    customLabel: 'Tỷ lệ thu NSNN của từng địa phương so với dự toán (đến ngày 19/10/2026)',
    groupName: 'I. Thu ngân sách nhà nước',
    visible: true,
    order: 2,
  },
  {
    rowNumber: 5,
    indicatorId: 'REV_LAND_RATE_Y',
    sttLabel: '',
    customLabel: 'Trong đó: tỷ lệ thu tiền sử dụng đất',
    groupName: 'I. Thu ngân sách nhà nước',
    visible: true,
    order: 3,
  },
  {
    rowNumber: 6,
    indicatorId: 'REV_NONLAND_RATE_Y',
    sttLabel: '',
    customLabel: 'Tỷ lệ thu không gồm tiền đất',
    groupName: 'I. Thu ngân sách nhà nước',
    visible: true,
    order: 4,
  },
  {
    rowNumber: 7,
    indicatorId: 'DISB_PLAN',
    sttLabel: '3',
    customLabel: 'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung',
    groupName: 'II. Giải ngân vốn đầu tư công',
    visible: true,
    order: 5,
  },
  {
    rowNumber: 8,
    indicatorId: 'DISB_PLAN_VS_AVG_COMMENT',
    sttLabel: '',
    customLabel: 'So với mức vốn giao bình quân một địa phương',
    groupName: 'II. Giải ngân vốn đầu tư công',
    visible: true,
    order: 6,
  },
  {
    rowNumber: 9,
    indicatorId: 'DISB_BENCHMARK_RATE',
    sttLabel: '4',
    customLabel: 'Tỷ lệ giải ngân trung bình của 114 địa phương (đến ngày 15/10/2026)',
    groupName: 'II. Giải ngân vốn đầu tư công',
    visible: true,
    order: 7,
  },
  {
    rowNumber: 10,
    indicatorId: 'DISB_RATE',
    sttLabel: '',
    customLabel: 'Tỷ lệ giải ngân của từng địa phương',
    groupName: 'II. Giải ngân vốn đầu tư công',
    visible: true,
    order: 8,
  },
  {
    rowNumber: 11,
    indicatorId: 'DISB_COMPARISON_LABEL',
    sttLabel: '',
    customLabel: 'Kết quả giải ngân so với tỷ lệ trung bình',
    groupName: 'II. Giải ngân vốn đầu tư công',
    visible: true,
    order: 9,
  },
  {
    rowNumber: 12,
    indicatorId: 'GPMB_BUDGET',
    sttLabel: '5',
    customLabel: 'Kinh phí phân bổ GPMB cho từng địa phương',
    groupName: 'III. Công tác giải phóng mặt bằng (GPMB)',
    visible: true,
    order: 10,
  },
  {
    rowNumber: 13,
    indicatorId: 'GPMB_AREA_PLAN',
    sttLabel: '6',
    customLabel: 'Diện tích phải GPMB của từng địa phương',
    groupName: 'III. Công tác giải phóng mặt bằng (GPMB)',
    visible: true,
    order: 11,
  },
  {
    rowNumber: 14,
    indicatorId: 'GPMB_BENCHMARK_AREA_RATE',
    sttLabel: '7',
    customLabel: 'Tỷ lệ GPMB trung bình của 114 địa phương (đến ngày 26/10/2026)',
    groupName: 'III. Công tác giải phóng mặt bằng (GPMB)',
    visible: true,
    order: 12,
  },
  {
    rowNumber: 15,
    indicatorId: 'GPMB_AREA_RATE',
    sttLabel: '',
    customLabel: 'Tỷ lệ GPMB của từng địa phương',
    groupName: 'III. Công tác giải phóng mặt bằng (GPMB)',
    visible: true,
    order: 13,
  },
  {
    rowNumber: 16,
    indicatorId: 'GPMB_COMPARISON_LABEL',
    sttLabel: '',
    customLabel: 'Kết quả GPMB so với tỷ lệ trung bình',
    groupName: 'III. Công tác giải phóng mặt bằng (GPMB)',
    visible: true,
    order: 14,
  },
];

/** Formats YYYY-MM-DD (or DD/MM/YYYY) into VN date string DD/MM/YYYY. */
export function formatVnDateText(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[3].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[1]}`;
  }
  return clean;
}

/** Replaces existing "(đến ngày ...)" suffix in an indicator label or appends one. */
export function replaceDateInLabel(label: string, dateVn: string): string {
  if (!dateVn) return label;
  if (/\(đến ngày[^\)]*\)/i.test(label)) {
    return label.replace(/\(đến ngày[^\)]*\)/i, `(đến ngày ${dateVn})`);
  }
  return `${label} (đến ngày ${dateVn})`;
}

/** Replace only known old default titles; keep genuinely custom labels. */
export function normalizeLocalityReportLabel(indicatorId: string, label: string): string {
  const trimmed = (label || '').trim();
  const aliases: Record<string, [string, string]> = {
    REV_RATE_Y: ['Tỷ lệ thu NSNN của từng xã so với dự toán', 'Tỷ lệ thu NSNN của từng địa phương so với dự toán'],
    DISB_PLAN: ['Kế hoạch vốn đầu tư công sau điều chỉnh, bổ sung', 'Kế hoạch vốn đầu tư công của từng địa phương sau điều chỉnh, bổ sung'],
    GPMB_BUDGET: ['Kinh phí phân bổ GPMB cho từng xã', 'Kinh phí phân bổ GPMB cho từng địa phương'],
    GPMB_AREA_PLAN: ['Diện tích phải GPMB của từng xã', 'Diện tích phải GPMB của từng địa phương'],
  };
  const pair = aliases[indicatorId];
  if (!pair) return label;
  const suffix = trimmed.match(/\s*\(đến ngày[^)]*\)$/i)?.[0] || '';
  const base = suffix ? trimmed.slice(0, -suffix.length).trimEnd() : trimmed;
  const isLegacyWardBudget = indicatorId === 'GPMB_BUDGET' && base === 'Kinh phí phân bổ GPMB cho từng phường';
  return base === pair[0] || isLegacyWardBudget ? pair[1] + suffix : label;
}

/** Fixed report-facing title for the city's 114-locality universe. Actual source coverage remains in audit/trace; this is not a calculation-scope assertion. */
export function formatBenchmarkReportLabel(params: {
  indicatorId: string;
  customLabel?: string;
  unitCount?: number;
  expectedCount?: number;
  asOfDate?: string;
}): string {
  const prefixes: Record<string, string> = {
    REV_BENCHMARK_RATE: 'Tỷ lệ thu NSNN',
    DISB_BENCHMARK_RATE: 'Tỷ lệ giải ngân',
    GPMB_BENCHMARK_AREA_RATE: 'Tỷ lệ GPMB',
  };
  const prefix = prefixes[params.indicatorId];
  const custom = params.customLabel?.trim() || '';
  if (!prefix) return custom;
  const oldDate = custom.match(/\s*\(đến ngày[^)]*\)$/i)?.[0] || '';
  const base = oldDate ? custom.slice(0, -oldDate.length).trimEnd() : custom;
  const scopePattern = /^(?:chung|trung bình) của (?:các địa phương|\d+(?:\/\d+)? địa phương(?: có dữ liệu)?)$/i;
  const legacyGpmb = params.indicatorId === 'GPMB_BENCHMARK_AREA_RATE' &&
    /^Tỷ lệ GPMB của danh mục địa bàn có dữ liệu \(\d+\/\d+ địa bàn\)$/i.test(base);
  const generated = !base || (base.startsWith(prefix + ' ') &&
    scopePattern.test(base.slice(prefix.length + 1))) || legacyGpmb;
  const dateVn = formatVnDateText(params.asOfDate);
  if (!generated) return dateVn && oldDate ? replaceDateInLabel(custom, dateVn) : custom;
  return prefix + ' trung bình của 114 địa phương' + (dateVn ? ' (đến ngày ' + dateVn + ')' : oldDate);
}

export function formatRevBenchmarkRowLabel(params: {
  customLabel?: string;
  unitCount?: number;
  expectedCount?: number;
  asOfDate?: string;
}): string {
  return formatBenchmarkReportLabel({ ...params, indicatorId: 'REV_BENCHMARK_RATE' });
}

/** Optional realized revenue row is a presentation toggle; numbering of the
 * base template is never mutated, so old sessions and backup data remain valid. */
export function reportMainStt(session: ReportSession, baseStt: string): string {
  return session.settings.showRevRealizedRow && /^\d+$/.test(baseStt) && Number(baseStt)>=2
    ? String(Number(baseStt)+1) : baseStt;
}
export function formatRevRealizedRowLabel(params: {customLabel?:string; asOfDate?:string}): string {
  const label=(params.customLabel || 'Kết quả thu NSNN').replace(/\s*\((?:tính\s+)?đến ngày[^)]*\)|\s*\(chưa xác nhận ngày chốt\)/gi,'').trim();
  const date=formatVnDateText(params.asOfDate);
  return label+(date?' (đến ngày '+date+')':' (chưa xác nhận ngày chốt)');
}

/** All three benchmark indicators are scope-level values, not locality values.
 * Use their shared trace but present only one value per page/table group. */
export function isSharedReportIndicator(indicatorId: string): boolean {
  return indicatorId === 'REV_BENCHMARK_RATE' || indicatorId === 'DISB_BENCHMARK_RATE' || indicatorId === 'GPMB_BENCHMARK_AREA_RATE';
}

/** Emphasize the three common benchmark percentages, independently of merging. */
export function isReportBenchmarkRate(indicatorId: string): boolean {
  return isSharedReportIndicator(indicatorId);
}
