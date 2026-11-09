import {
  CoverageDetail,
  Dataset,
  Locality,
} from './types';

export interface DatasetCoverageSummary {
  datasetId: string;
  sourceType: 'REV' | 'DISB' | 'GPMB';
  presentLocalityCount: number;
  expectedLocalityCount: number;
  missingLocalities: CoverageDetail[];
  fieldMissingDetails: CoverageDetail[];
  partialAggregateLocalities: CoverageDetail[];
  zeroValidDetails: CoverageDetail[];
}

export function analyzeSourceCoverage(
  baselineLocalities: Locality[],
  datasets: {
    DISB?: Dataset;
    REV?: Dataset;
    GPMB?: Dataset;
  }
): {
  bySource: Record<string, DatasetCoverageSummary>;
  allCoverageDetails: CoverageDetail[];
} {
  const expectedCount = baselineLocalities.length;
  const bySource: Record<string, DatasetCoverageSummary> = {};
  const allCoverageDetails: CoverageDetail[] = [];

  // 1. DISB Coverage
  if (datasets.DISB) {
    const disb = datasets.DISB;
    const presentIds = new Set(disb.records.map((r) => r.localityId));
    const missingLocalities: CoverageDetail[] = [];
    for (const loc of baselineLocalities) {
      if (!presentIds.has(loc.id)) {
        const item: CoverageDetail = {
          localityId: loc.id,
          localityName: loc.canonicalNameNFC,
          sourceDatasetId: disb.id,
          sourceType: 'DISB',
          status: 'NO_LOCALITY_RECORD',
          reason: `Không có bản ghi địa phương trong ${disb.sourceFilename}!${disb.sourceSheet} (không suy diễn là không phát sinh vốn).`,
          sourceSheet: disb.sourceSheet,
          asOfDate: disb.asOfDate,
          impactOnComputation: 'Không có số liệu giải ngân cho địa phương này',
        };
        missingLocalities.push(item);
        allCoverageDetails.push(item);
      }
    }

    const fieldMissingDetails: CoverageDetail[] = [];
    const compCols: Array<{ field: string; col: string }> = [
      { field: 'adjusted_city_component', col: 'G' },
      { field: 'disbursed_city_component', col: 'J' },
      { field: 'disbursed_gpmb', col: 'M' },
      { field: 'disbursed_other', col: 'N' },
    ];
    for (const rec of disb.records) {
      for (const { field, col } of compCols) {
        const cell = rec.metrics[field];
        if (cell && cell.state === 'MISSING') {
          const detail: CoverageDetail = {
            localityId: rec.localityId,
            localityName: rec.localityName,
            sourceDatasetId: disb.id,
            sourceType: 'DISB',
            fieldId: field,
            status: 'FIELD_MISSING',
            reason: `Có dòng địa phương tại ${disb.sourceSheet}!B${rec.sourceRow} nhưng ô thành phần ${col}${rec.sourceRow} để trống (FIELD_MISSING, không phải thiếu địa phương và không tự gán 0).`,
            sourceSheet: disb.sourceSheet,
            sourceCell: `${col}${rec.sourceRow}`,
            asOfDate: disb.asOfDate,
            impactOnComputation:
              'Giữ trạng thái MISSING khi xem độc lập; chỉ trung hòa có kiểm soát khi kiểm tra cân đối ngang.',
          };
          fieldMissingDetails.push(detail);
          allCoverageDetails.push(detail);
        }
      }
    }

    bySource.DISB = {
      datasetId: disb.id,
      sourceType: 'DISB',
      presentLocalityCount: presentIds.size,
      expectedLocalityCount: expectedCount,
      missingLocalities,
      fieldMissingDetails,
      partialAggregateLocalities: [],
      zeroValidDetails: [],
    };
  }

  // 2. REV Coverage
  if (datasets.REV) {
    const rev = datasets.REV;
    const presentIds = new Set(rev.records.map((r) => r.localityId));
    const missingLocalities: CoverageDetail[] = [];

    for (const loc of baselineLocalities) {
      if (!presentIds.has(loc.id)) {
        const item: CoverageDetail = {
          localityId: loc.id,
          localityName: loc.canonicalNameNFC,
          sourceDatasetId: rev.id,
          sourceType: 'REV',
          status: 'NO_LOCALITY_RECORD',
          reason: `Không có bản ghi của "${loc.canonicalNameNFC}" trong danh sách địa phương của sheet ${rev.sourceSheet} (chỉ có ${presentIds.size}/${expectedCount} địa phương; không tự bù 0).`,
          sourceSheet: rev.sourceSheet,
          asOfDate: rev.asOfDate || 'UNCONFIRMED',
          impactOnComputation:
            'Không đưa vào mốc 113 địa phương có dữ liệu; hiển thị "Chưa có bản ghi nguồn" tại cột địa phương.',
        };
        missingLocalities.push(item);
        allCoverageDetails.push(item);
      }
    }

    const zeroValidDetails: CoverageDetail[] = [];
    for (const rec of rev.records) {
      const dCell = rec.metrics['annual_land_budget'];
      const gCell = rec.metrics['period_land_plan'];
      const rCell = rec.metrics['actual_land_revenue'];
      if (dCell?.state === 'ZERO') {
        const item: CoverageDetail = {
          localityId: rec.localityId,
          localityName: rec.localityName,
          sourceDatasetId: rev.id,
          sourceType: 'REV',
          fieldId: 'annual_land_budget',
          status: 'ZERO_VALID',
          reason: `Ô D${rec.sourceRow} ghi số 0 hợp lệ (ZERO_VALID, khác với FIELD_MISSING). Tỷ lệ thu đất cấp địa phương là "Phát sinh ngoài dự toán", nhưng số thu R${rec.sourceRow}=${rCell?.normalizedDecimal ?? '0'} triệu vẫn cộng vào tử số benchmark tổng/tổng.`,
          sourceSheet: rev.sourceSheet,
          sourceCell: `D${rec.sourceRow}`,
          asOfDate: rev.asOfDate || 'UNCONFIRMED',
          impactOnComputation: 'Tham gia đầy đủ vào SUM(R)/SUM(D) toàn phạm vi (R04).',
        };
        zeroValidDetails.push(item);
        allCoverageDetails.push(item);
      }
      if (gCell?.state === 'ZERO') {
        const item: CoverageDetail = {
          localityId: rec.localityId,
          localityName: rec.localityName,
          sourceDatasetId: rev.id,
          sourceType: 'REV',
          fieldId: 'period_land_plan',
          status: 'ZERO_VALID',
          reason: `Ô G${rec.sourceRow} ghi số 0 hợp lệ (ZERO_VALID). Tỷ lệ thu đất kỳ là "Phát sinh ngoài kế hoạch", số thu R${rec.sourceRow}=${rCell?.normalizedDecimal ?? '0'} triệu vẫn cộng vào tử số benchmark tổng/tổng.`,
          sourceSheet: rev.sourceSheet,
          sourceCell: `G${rec.sourceRow}`,
          asOfDate: rev.asOfDate || 'UNCONFIRMED',
          impactOnComputation: 'Tham gia đầy đủ vào SUM(R)/SUM(G) toàn phạm vi (R04).',
        };
        zeroValidDetails.push(item);
        allCoverageDetails.push(item);
      }
    }

    bySource.REV = {
      datasetId: rev.id,
      sourceType: 'REV',
      presentLocalityCount: presentIds.size,
      expectedLocalityCount: expectedCount,
      missingLocalities,
      fieldMissingDetails: [],
      partialAggregateLocalities: [],
      zeroValidDetails,
    };
  }

  // 3. GPMB Coverage
  if (datasets.GPMB) {
    const gpmb = datasets.GPMB;
    const presentIds = new Set(
      gpmb.localityGroupSummaries
        ? Object.keys(gpmb.localityGroupSummaries)
        : gpmb.records.map((r) => r.localityId)
    );
    const missingLocalities: CoverageDetail[] = [];

    for (const loc of baselineLocalities) {
      if (!presentIds.has(loc.id)) {
        const item: CoverageDetail = {
          localityId: loc.id,
          localityName: loc.canonicalNameNFC,
          sourceDatasetId: gpmb.id,
          sourceType: 'GPMB',
          status: 'NO_LOCALITY_RECORD',
          reason: `Không có dòng nhóm địa bàn "${loc.canonicalNameNFC}" trong phụ lục GPMB (${gpmb.sourceSheet}); tuyệt đối không suy diễn là không có dự án hay gán 0% / 100%.`,
          sourceSheet: gpmb.sourceSheet,
          asOfDate: gpmb.asOfDate,
          impactOnComputation:
            'Ngoài phạm vi 108 địa bàn có dữ liệu; hiển thị "Chưa có bản ghi nguồn GPMB".',
        };
        missingLocalities.push(item);
        allCoverageDetails.push(item);
      }
    }

    const fieldMissingDetails: CoverageDetail[] = [];
    const partialMap = new Map<string, CoverageDetail>();

    for (const rec of gpmb.records) {
      const dCell = rec.metrics['gpmb_declared_area'];
      const iCell = rec.metrics['gpmb_recorded_area'];
      if (
        (dCell?.state === 'VALUE' || dCell?.state === 'ZERO') &&
        iCell?.state === 'MISSING'
      ) {
        const fDetail: CoverageDetail = {
          localityId: rec.localityId,
          localityName: rec.localityName,
          sourceDatasetId: gpmb.id,
          sourceType: 'GPMB',
          fieldId: 'gpmb_recorded_area',
          status: 'FIELD_MISSING',
          reason: `Có địa bàn "${rec.localityName}" trong GPMB nhưng dự án STT ${rec.projectStt} (dòng ${rec.sourceRow}, D${rec.sourceRow}=${dCell.normalizedDecimal} m²) để trống ô I${rec.sourceRow} và M${rec.sourceRow}.`,
          sourceSheet: gpmb.sourceSheet,
          sourceCell: `I${rec.sourceRow}`,
          asOfDate: gpmb.asOfDate,
          impactOnComputation: `D${rec.sourceRow}=${dCell.normalizedDecimal} m² vẫn giữ trong mẫu số; tổng diện tích đã GPMB đánh cờ PARTIAL_AGGREGATE.`,
        };
        fieldMissingDetails.push(fDetail);
        allCoverageDetails.push(fDetail);

        const pDetail: CoverageDetail = {
          localityId: rec.localityId,
          localityName: rec.localityName,
          sourceDatasetId: gpmb.id,
          sourceType: 'GPMB',
          fieldId: 'GPMB_AREA_RATE',
          status: 'PARTIAL_AGGREGATE',
          reason: `Địa bàn "${rec.localityName}" có dự án dòng ${rec.sourceRow} thiếu kết quả I${rec.sourceRow}; tỷ lệ theo diện tích chỉ phản ánh phần đã ghi nhận (PARTIAL_AGGREGATE).`,
          sourceSheet: gpmb.sourceSheet,
          sourceCell: `I${rec.sourceRow}`,
          asOfDate: gpmb.asOfDate,
          impactOnComputation:
            'Gắn cờ PARTIAL_AGGREGATE, không tự sinh nhận xét đạt/chưa đạt nếu chưa được phê duyệt.',
        };
        partialMap.set(rec.localityId, pDetail);
        allCoverageDetails.push(pDetail);
      }
    }

    bySource.GPMB = {
      datasetId: gpmb.id,
      sourceType: 'GPMB',
      presentLocalityCount: presentIds.size,
      expectedLocalityCount: expectedCount,
      missingLocalities,
      fieldMissingDetails,
      partialAggregateLocalities: Array.from(partialMap.values()),
      zeroValidDetails: [],
    };
  }

  return { bySource, allCoverageDetails };
}

export function filterCoverageForSession(
  allCoverageDetails: CoverageDetail[],
  selectedLocalityIds: string[],
  includeGlobalMissingForBenchmark = true
): CoverageDetail[] {
  const selectedSet = new Set(selectedLocalityIds);
  return allCoverageDetails.filter((item) => {
    if (selectedSet.has(item.localityId)) return true;
    if (includeGlobalMissingForBenchmark && item.status === 'NO_LOCALITY_RECORD') {
      return true;
    }
    return false;
  });
}
