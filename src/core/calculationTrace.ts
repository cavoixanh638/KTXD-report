import {
   Decimal,
  formatVnNumber,
  formatVnPercent,
  m2ToHa,
  millionToBillion,
  vndToBillion,
  vndToMillion,
} from './decimal';
import {
  CalculationQuality,
  CalculationTrace,
  CoverageDetail,
  Dataset,
  formatDisbRange,
  getDisbSchemaProfile,
  Locality,
  MetricCellValue,
  QualityIssue,
  ReportSession,
  SourceCellRef,
  SourceRecord,
  TemplateRowCustomConfig,
  ValueState,
  ZeroDenominatorContributor,
} from './types';
import {
  DEFAULT_INDICATORS,
  formatRevBenchmarkRowLabel,
  formatBenchmarkReportLabel,
  normalizeLocalityReportLabel,
  formatRevRealizedRowLabel,
  reportMainStt,
  IndicatorDefinition,
} from './indicators';
import { getUncompletedProjectsForSession } from './uncompletedProjects';

export function makeSourceCellRef(
  dataset: Dataset,
  cell: MetricCellValue
): SourceCellRef {
  return {
    datasetId: dataset.id,
    fileName: dataset.sourceFilename,
    fileSha256: dataset.workbookSha256,
    sheetName: cell.provenance.sheet,
    sheetIndex: cell.provenance.sheetIndex,
    sheetVisibility: cell.provenance.sheetVisibility,
    address: cell.provenance.cell,
    sourceFormula: cell.provenance.formula,
    sourceFormulaVerification: cell.provenance.formula
      ? 'VERIFIED'
      : 'NOT_APPLICABLE',
    cachedValue: cell.provenance.cachedValue,
    asOfDate: dataset.asOfDate || 'UNCONFIRMED',
    mappingVersion: dataset.mappingVersion,
  };
}

export function buildSourceValueTrace(
  dataset: Dataset,
  record: SourceRecord,
  fieldId: string
): CalculationTrace {
  const cell = record.metrics[fieldId];
  const ref = makeSourceCellRef(dataset, cell);
  const traceId = `TRACE_SRC_${dataset.id}_${record.id}_${fieldId}`;

  return {
    traceId,
    indicatorId: fieldId,
    localityId: record.localityId,
    localityName: record.localityName,
    resultKind: 'SOURCE_VALUE',
    result: {
      exactDecimal: cell.normalizedDecimal,
      displayedText:
        cell.state === 'MISSING'
          ? 'Chưa có số liệu (MISSING)'
          : cell.state === 'FORMULA_ERROR'
          ? `Lỗi công thức nguồn (${cell.raw})`
          : cell.normalizedDecimal ?? String(cell.raw ?? ''),
      canonicalUnit: cell.unit,
      displayUnit: cell.unit,
      state: cell.state,
    },
    formula: {
      formulaId: 'DIRECT_SOURCE_CELL',
      formulaVersion: '2.2',
      readableExpression: cell.provenance.formula
        ? `Giá trị nhập trực tiếp từ nguồn (ô ${ref.address} có công thức nguồn Excel: =${cell.provenance.formula})`
        : `Giá trị nhập trực tiếp từ nguồn, không phải kết quả tính (${ref.sheetName}!${ref.address})`,
      expressionTree: { type: 'SOURCE_CELL', address: ref.address, sourceFormula: cell.provenance.formula },
      method: 'DIRECT_READ',
      roundingPolicy: 'NONE_RAW_SOURCE',
      tolerancePolicy: 'EXACT',
    },
    scope: {
      type: 'SOURCE_CELL',
      sourceDatasetIds: [dataset.id],
      selectedLocalityIds: [record.localityId],
      matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
      asOfDates: [dataset.asOfDate || 'UNCONFIRMED'],
    },
    operands: [
      {
        role: 'source',
        fieldId,
        exactValue: cell.normalizedDecimal,
        unit: cell.unit,
        state: cell.state,
        sources: [ref],
      },
    ],
    population: {
      eligibleCount: 1,
      includedCount: cell.state === 'VALUE' || cell.state === 'ZERO' ? 1 : 0,
      excludedCount: cell.state === 'VALUE' || cell.state === 'ZERO' ? 0 : 1,
      missingCount: cell.state === 'MISSING' ? 1 : 0,
      includedRecordIds:
        cell.state === 'VALUE' || cell.state === 'ZERO' ? [record.id] : [],
      excludedRecordIds:
        cell.state === 'VALUE' || cell.state === 'ZERO' ? [] : [record.id],
    },
    coverageDetails: [],
    exclusions: [],
    steps: [
      {
        operation: 'READ_SOURCE_CELL',
        inputs: [`${ref.sheetName}!${ref.address}`],
        output: cell.normalizedDecimal,
        inputUnit: cell.unit,
        outputUnit: cell.unit,
        reason: 'Giá trị nhập trực tiếp từ nguồn, không phải kết quả tính của ứng dụng.',
      },
    ],
    quality: {
      status:
        cell.state === 'FORMULA_ERROR'
          ? 'SOURCE_ERROR'
          : cell.state === 'MISSING'
          ? 'INSUFFICIENT_COMPONENTS'
          : 'COMPLETE',
      warningIds: [],
    },
    sourceRefs: [ref],
    createdAt: new Date().toISOString(),
    engineVersion: '2.2.0',
    datasetHashes: [dataset.workbookSha256],
  };
}

/**
 * Computes a benchmark ratio `SUM(numerator) / SUM(denominator) * 100`
 * strictly following Master V2.2 §3, §6A.3, and §6A.3a (R04 zero-denominator rule).
 */
export function computeBenchmarkRatio(params: {
  indicatorId: string;
  dataset: Dataset;
  baselineLocalities: Locality[];
  numeratorField: string;
  denominatorField: string;
  scopeType:
    | 'LOCALITIES_FULL_114'
    | 'LOCALITIES_AVAILABLE_N'
    | 'PROJECT_PORTFOLIO_CITY'
    | 'CITY_TOTAL_OFFICIAL'
    | 'SELECTED_UNITS';
  selectedLocalityIds?: string[];
  decimals?: number;
  excludeUnplanned251163?: boolean;
  /** Used in T55/T56 regression tests to verify the engine rejects naive B_i > 0 filtering */
  naiveExcludeZeroDenominatorForTestOnly?: boolean;
}): {
  exactPercent: Decimal | null;
  exactRatio: Decimal | null;
  numeratorSum: Decimal;
  denominatorSum: Decimal;
  displayedText: string;
  scopeLabel: string;
  trace: CalculationTrace;
} {
  const {
    indicatorId,
    dataset,
    baselineLocalities,
    numeratorField,
    denominatorField,
    scopeType,
    selectedLocalityIds,
    decimals = 2,
    excludeUnplanned251163 = false,
    naiveExcludeZeroDenominatorForTestOnly = false,
  } = params;

  const expectedCount = baselineLocalities.length || 114;

  // Handle DISB CITY_TOTAL_OFFICIAL (Row 7, optionally minus Row 145)
  if (
    dataset.sourceType === 'DISB' &&
    scopeType === 'CITY_TOTAL_OFFICIAL' &&
    dataset.citySummaryRecord
  ) {
    const cityRec = dataset.citySummaryRecord;
    const fCell = cityRec.metrics['adjusted_total_plan'];
    const iCell = cityRec.metrics['disbursed_total'];
    const fDec = new Decimal(fCell.normalizedDecimal || '0');
    let iDec = new Decimal(iCell.normalizedDecimal || '0');
    const sourceRefs: SourceCellRef[] = [
      makeSourceCellRef(dataset, iCell),
      makeSourceCellRef(dataset, fCell),
    ];
    const exclusions: CalculationTrace['exclusions'] = [];

    if (excludeUnplanned251163 && dataset.unplannedDisbursementRecord) {
      const unpCell =
        dataset.unplannedDisbursementRecord.metrics['disbursed_total'];
      if (unpCell?.normalizedDecimal) {
        iDec = iDec.minus(new Decimal(unpCell.normalizedDecimal));
        sourceRefs.push(makeSourceCellRef(dataset, unpCell));
        exclusions.push({
          recordId: 'DISB_R145',
          affectedOperand: 'numerator',
          reasonCode: 'SCENARIO_EXCLUSION',
          explanation:
            'Loại khoản giải ngân 251.163 triệu đồng ngoài kế hoạch vốn thành phố giao tại dòng 145.',
          sourceCell: 'I145',
          sourceValue: unpCell.normalizedDecimal,
        });
      }
    }

    const ratio = iDec.div(fDec);
    const pct = ratio.mul(100);
    const displayedText = formatVnPercent(pct, decimals);
    const scopeLabel = excludeUnplanned251163
      ? 'Toàn thành phố (đã loại 251,163 tỷ giải ngân ngoài kế hoạch tại I145)'
      : 'Toàn thành phố (theo hiển thị nguồn I7/F7, gồm cả đơn vị ngoài khối xã/phường)';

    const trace: CalculationTrace = {
      traceId: `TRACE_BM_${indicatorId}_CITY_${excludeUnplanned251163 ? 'ADJ' : 'RAW'}`,
      indicatorId,
      resultKind: 'CALCULATED',
      result: {
        exactDecimal: pct.toString(),
        displayedText,
        canonicalUnit: 'percent',
        displayUnit: '%',
        state: 'VALUE',
      },
      formula: {
        formulaId: excludeUnplanned251163
          ? 'CITY_TOTAL_EXCL_ROW145'
          : 'CITY_TOTAL_RAW_ROW7',
        formulaVersion: '2.2',
        readableExpression: excludeUnplanned251163
          ? '(I7 - I145) / F7 * 100'
          : 'I7 / F7 * 100',
        expressionTree: {
          op: 'MUL',
          lhs: {
            op: 'DIV',
            num: excludeUnplanned251163 ? 'I7 - I145' : 'I7',
            den: 'F7',
          },
          rhs: 100,
        },
        method: excludeUnplanned251163
          ? 'CITY_ADJUSTED_SCENARIO'
          : 'RATIO_OF_SUMS',
        roundingPolicy: `ROUND_HALF_UP_${decimals}`,
        tolerancePolicy: 'EXACT_DECIMAL',
      },
      scope: {
        type: 'CITY_TOTAL_OFFICIAL',
        sourceDatasetIds: [dataset.id],
        selectedLocalityIds: [],
        matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
        asOfDates: [dataset.asOfDate],
      },
      operands: [
        {
          role: 'numerator',
          fieldId: 'disbursed_total',
          exactValue: iDec.toString(),
          unit: 'million_vnd',
          state: 'VALUE',
          sources: [makeSourceCellRef(dataset, iCell)],
        },
        {
          role: 'denominator',
          fieldId: 'adjusted_total_plan',
          exactValue: fDec.toString(),
          unit: 'million_vnd',
          state: 'VALUE',
          sources: [makeSourceCellRef(dataset, fCell)],
        },
      ],
      population: {
        eligibleCount: 1,
        includedCount: 1,
        excludedCount: exclusions.length,
        missingCount: 0,
        includedRecordIds: ['DISB_R7'],
        excludedRecordIds: exclusions.map((e) => e.recordId),
      },
      coverageDetails: [],
      exclusions,
      steps: [
        {
          operation: 'DIVIDE_AND_PERCENT',
          inputs: [iDec.toString(), fDec.toString()],
          output: pct.toString(),
          inputUnit: 'million_vnd',
          outputUnit: 'percent',
          reason: scopeLabel,
        },
        {
          operation: 'ROUND',
          inputs: [pct.toString()],
          output: displayedText,
          inputUnit: 'percent',
          outputUnit: '%',
          reason: `Làm tròn ROUND_HALF_UP ${decimals} chữ số thập phân`,
        },
      ],
      quality: {
        status: 'COMPLETE',
        warningIds: [],
      },
      sourceRefs,
      createdAt: new Date().toISOString(),
      engineVersion: '2.2.0',
      datasetHashes: [dataset.workbookSha256],
    };

    return {
      exactPercent: pct,
      exactRatio: ratio,
      numeratorSum: iDec,
      denominatorSum: fDec,
      displayedText,
      scopeLabel,
      trace,
    };
  }

  // Filter candidate records by scope
  const selectedSet =
    scopeType === 'SELECTED_UNITS' && selectedLocalityIds
      ? new Set(selectedLocalityIds)
      : null;

  const candidateRecords = dataset.records.filter((r) =>
    selectedSet ? selectedSet.has(r.localityId) : true
  );

  let numSum = new Decimal(0);
  let denSum = new Decimal(0);
  let missingDeclaredAreaSum = new Decimal(0);

  const includedRecordIds: string[] = [];
  const excludedRecordIds: string[] = [];
  const exclusions: CalculationTrace['exclusions'] = [];
  const coverageDetails: CoverageDetail[] = [];
  const zeroDenominatorContributors: ZeroDenominatorContributor[] = [];
  const sourceRefs: SourceCellRef[] = [];

  // Coverage check for missing localities in dataset vs baseline
  if (scopeType !== 'SELECTED_UNITS') {
    const presentLocIds = new Set(
      dataset.sourceType === 'GPMB' && dataset.localityGroupSummaries
        ? Object.keys(dataset.localityGroupSummaries)
        : dataset.records.map((r) => r.localityId)
    );
    for (const loc of baselineLocalities) {
      if (!presentLocIds.has(loc.id)) {
        coverageDetails.push({
          localityId: loc.id,
          localityName: loc.canonicalNameNFC,
          sourceDatasetId: dataset.id,
          sourceType: dataset.sourceType as 'REV' | 'DISB' | 'GPMB',
          status: 'NO_LOCALITY_RECORD',
          reason: `Không có bản ghi của "${loc.canonicalNameNFC}" trong ${dataset.sourceSheet} (không tự bù 0).`,
          sourceSheet: dataset.sourceSheet,
          asOfDate: dataset.asOfDate || 'UNCONFIRMED',
          impactOnComputation: 'Không tính vào tập N địa phương có dữ liệu.',
        });
        exclusions.push({
          recordId: loc.id,
          affectedOperand: 'both',
          reasonCode: 'SOURCE_NOT_PRESENT',
          explanation: `Địa phương "${loc.canonicalNameNFC}" không có bản ghi trong nguồn ${dataset.sourceSheet}.`,
        });
        excludedRecordIds.push(loc.id);
      }
    }
  } else if (selectedLocalityIds) {
    const presentLocIds = new Set(
      dataset.sourceType === 'GPMB' && dataset.localityGroupSummaries
        ? Object.keys(dataset.localityGroupSummaries)
        : dataset.records.map((r) => r.localityId)
    );
    for (const locId of selectedLocalityIds) {
      if (!presentLocIds.has(locId)) {
        const locObj = baselineLocalities.find((l) => l.id === locId);
        const locName = locObj ? locObj.canonicalNameNFC : locId;
        coverageDetails.push({
          localityId: locId,
          localityName: locName,
          sourceDatasetId: dataset.id,
          sourceType: dataset.sourceType as 'REV' | 'DISB' | 'GPMB',
          status: 'NO_LOCALITY_RECORD',
          reason: `Địa phương được chọn "${locName}" không có bản ghi trong ${dataset.sourceSheet}.`,
          sourceSheet: dataset.sourceSheet,
          asOfDate: dataset.asOfDate || 'UNCONFIRMED',
          impactOnComputation: 'Bỏ qua khỏi tổng nhóm, gắn cảnh báo thiếu nguồn.',
        });
        exclusions.push({
          recordId: locId,
          affectedOperand: 'both',
          reasonCode: 'SOURCE_NOT_PRESENT',
          explanation: `Địa phương "${locName}" không có bản ghi trong ${dataset.sourceSheet}.`,
        });
        excludedRecordIds.push(locId);
      }
    }
  }

  // Iterate over candidate records
  for (const rec of candidateRecords) {
    const numCell = rec.metrics[numeratorField];
    const denCell = rec.metrics[denominatorField];
    if (!numCell || !denCell) continue;

    // Special case: GPMB recorded area ratio (D present, I may be MISSING on rows 107, 173, 365)
    if (dataset.sourceType === 'GPMB' && numeratorField === 'gpmb_recorded_area') {
      const dValid = denCell.state === 'VALUE' || denCell.state === 'ZERO';
      const iValid = numCell.state === 'VALUE' || numCell.state === 'ZERO';

      if (dValid && denCell.normalizedDecimal) {
        const dVal = new Decimal(denCell.normalizedDecimal);
        denSum = denSum.plus(dVal);
        sourceRefs.push(makeSourceCellRef(dataset, denCell));

        if (iValid && numCell.normalizedDecimal) {
          const iVal = new Decimal(numCell.normalizedDecimal);
          numSum = numSum.plus(iVal);
          includedRecordIds.push(rec.id);
          sourceRefs.push(makeSourceCellRef(dataset, numCell));
        } else {
          // I is MISSING (e.g., rows 107, 173, 365)
          missingDeclaredAreaSum = missingDeclaredAreaSum.plus(dVal);
          includedRecordIds.push(rec.id); // Included in denominator per Excel SUM policy
          coverageDetails.push({
            localityId: rec.localityId,
            localityName: rec.localityName,
            sourceDatasetId: dataset.id,
            sourceType: 'GPMB',
            fieldId: numeratorField,
            status: 'FIELD_MISSING',
            reason: `Dự án STT ${rec.projectStt} (dòng ${rec.sourceRow}, ${rec.localityName}) có D${rec.sourceRow}=${dVal.toString()} m² nhưng I${rec.sourceRow} trống (MISSING).`,
            sourceSheet: dataset.sourceSheet,
            sourceCell: `I${rec.sourceRow}`,
            asOfDate: dataset.asOfDate,
            impactOnComputation: `Giữ D=${dVal.toString()} m² trong mẫu số, I chưa có dữ liệu không đóng góp vào tử số đã ghi nhận; gắn cờ PARTIAL_AGGREGATE.`,
          });
          exclusions.push({
            recordId: rec.id,
            affectedOperand: 'numerator',
            reasonCode: 'MISSING_INPUT',
            explanation: `Ô I${rec.sourceRow} trống (MISSING); diện tích phải GPMB D${rec.sourceRow}=${dVal.toString()} m² vẫn nằm trong mẫu số tổng.`,
            sourceCell: `I${rec.sourceRow}`,
            sourceValue: null,
          });
        }
      } else {
        excludedRecordIds.push(rec.id);
        exclusions.push({
          recordId: rec.id,
          affectedOperand: 'denominator',
          reasonCode: 'MISSING_INPUT',
          explanation: `Ô D${rec.sourceRow} thiếu hoặc không hợp lệ.`,
          sourceCell: `D${rec.sourceRow}`,
        });
      }
      continue;
    }

    // Standard RATIO(SUM(A), SUM(B)) with Rule P0 / R04
    const numValid = numCell.state === 'VALUE' || numCell.state === 'ZERO';
    const denValid = denCell.state === 'VALUE' || denCell.state === 'ZERO';

    if (!numValid || !denValid || !numCell.normalizedDecimal || !denCell.normalizedDecimal) {
      excludedRecordIds.push(rec.id);
      exclusions.push({
        recordId: rec.id,
        affectedOperand: !numValid ? 'numerator' : 'denominator',
        reasonCode:
          numCell.state === 'FORMULA_ERROR' || denCell.state === 'FORMULA_ERROR'
            ? 'FORMULA_ERROR'
            : 'MISSING_INPUT',
        explanation: `Bản ghi ${rec.id} (${rec.localityName}) có toán hạng thiếu hoặc lỗi công thức.`,
        sourceCell: !numValid ? numCell.provenance.cell : denCell.provenance.cell,
      });
      continue;
    }

    const numDec = new Decimal(numCell.normalizedDecimal);
    const denDec = new Decimal(denCell.normalizedDecimal);

    if (denDec.isZero()) {
      if (naiveExcludeZeroDenominatorForTestOnly) {
        // Anti-regression test mode (T55, T56): records the wrong exclusion so tests can assert it FAILS policy
        excludedRecordIds.push(rec.id);
        exclusions.push({
          recordId: rec.id,
          affectedOperand: 'both',
          reasonCode: 'NO_VALID_DENOMINATOR',
          explanation: `[SAI QUY TẮC R04] Loại bỏ dòng ${rec.sourceRow} (${rec.localityName}) vì mẫu số bằng 0 làm mất ${numDec.toString()} ở tử số.`,
          sourceCell: denCell.provenance.cell,
          sourceValue: numDec.toString(),
        });
        continue;
      }

      // Rule P0 / R04: B_i = 0 is a VALID ZERO and MUST be included in both sums!
      zeroDenominatorContributors.push({
        recordId: rec.id,
        localityId: rec.localityId,
        localityName: rec.localityName,
        numeratorFieldId: numeratorField,
        denominatorFieldId: denominatorField,
        numeratorExactDecimal: numDec.toString(),
        denominatorExactDecimal: '0',
        numeratorSource: makeSourceCellRef(dataset, numCell),
        denominatorSource: makeSourceCellRef(dataset, denCell),
      });
    }

    numSum = numSum.plus(numDec);
    denSum = denSum.plus(denDec);
    includedRecordIds.push(rec.id);
    sourceRefs.push(
      makeSourceCellRef(dataset, numCell),
      makeSourceCellRef(dataset, denCell)
    );
  }

  let exactRatio: Decimal | null = null;
  let exactPercent: Decimal | null = null;
  let displayedText = 'Không có cơ sở tính tỷ lệ';
  let qualityStatus: CalculationQuality = 'COMPLETE';
  let resultState: ValueState = 'VALUE';

  if (denSum.isZero()) {
    qualityStatus = 'DENOMINATOR_ZERO';
    resultState = 'NOT_APPLICABLE';
    displayedText = numSum.gt(0)
      ? 'Phát sinh ngoài dự toán/kế hoạch (Tổng mẫu số = 0)'
      : 'Không có cơ sở tính tỷ lệ';
  } else {
    exactRatio = numSum.div(denSum);
    exactPercent = exactRatio.mul(100);
    displayedText = formatVnPercent(exactPercent, decimals);

    if (missingDeclaredAreaSum.gt(0)) {
      qualityStatus = 'PARTIAL_AGGREGATE';
    } else if (naiveExcludeZeroDenominatorForTestOnly) {
      qualityStatus = 'SOURCE_ERROR';
    }
  }

  const presentUnitsCount =
    dataset.sourceType === 'GPMB'
      ? dataset.unitCount
      : includedRecordIds.length;
  const scopeLabel =
    scopeType === 'LOCALITIES_FULL_114'
      ? `114/${expectedCount} địa phương`
      : scopeType === 'LOCALITIES_AVAILABLE_N' || scopeType === 'PROJECT_PORTFOLIO_CITY'
      ? dataset.sourceType === 'GPMB'
        ? `Danh mục dự án tại ${presentUnitsCount}/${expectedCount} địa bàn có dữ liệu (${includedRecordIds.length} dự án, PARTIAL_AGGREGATE)`
        : `${presentUnitsCount}/${expectedCount} địa phương có dữ liệu (tham khảo, thiếu ${expectedCount - presentUnitsCount} địa phương)`
      : `Nhóm ${selectedLocalityIds?.length ?? 0} địa phương đang chọn`;

  const trace: CalculationTrace = {
    traceId: `TRACE_BM_${indicatorId}_${scopeType}_${dataset.id}`,
    indicatorId,
    resultKind: 'CALCULATED',
    result: {
      exactDecimal: exactPercent ? exactPercent.toString() : null,
      displayedText,
      canonicalUnit: 'percent',
      displayUnit: '%',
      state: resultState,
    },
    formula: {
      formulaId:
        dataset.sourceType === 'GPMB'
          ? 'GPMB_RECORDED_AREA_RATIO_BENCHMARK'
          : 'BENCHMARK_RATIO_OF_SUMS_R04',
      formulaVersion: '2.2',
      readableExpression: `SUM(${numeratorField}) / SUM(${denominatorField}) * 100 (${scopeLabel})`,
      expressionTree: {
        op: 'MUL',
        lhs: {
          op: 'DIV',
          num: { op: 'SUM', field: numeratorField },
          den: { op: 'SUM', field: denominatorField },
        },
        rhs: 100,
      },
      method:
        dataset.sourceType === 'GPMB'
          ? 'GPMB_RECORDED_AREA_RATIO'
          : 'RATIO(SUM(A),SUM(B))',
      roundingPolicy: `ROUND_HALF_UP_${decimals}`,
      tolerancePolicy: 'EXACT_DECIMAL',
    },
    scope: {
      type: scopeType,
      sourceDatasetIds: [dataset.id],
      selectedLocalityIds: selectedLocalityIds ?? [],
      expectedCount,
      matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
      asOfDates: [dataset.asOfDate || 'UNCONFIRMED'],
    },
    operands: [
      {
        role: 'numerator_sum',
        fieldId: numeratorField,
        exactValue: numSum.toString(),
        unit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        state: numSum.isZero() ? 'ZERO' : 'VALUE',
        sources: sourceRefs.slice(0, 20),
      },
      {
        role: 'denominator_sum',
        fieldId: denominatorField,
        exactValue: denSum.toString(),
        unit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        state: denSum.isZero() ? 'ZERO' : 'VALUE',
        sources: sourceRefs.slice(0, 20),
      },
    ],
    population: {
      eligibleCount:
        dataset.sourceType === 'GPMB' ? candidateRecords.length : expectedCount,
      includedCount: includedRecordIds.length,
      excludedCount: excludedRecordIds.length,
      missingCount: coverageDetails.length,
      includedRecordIds,
      excludedRecordIds,
    },
    coverageDetails,
    exclusions,
    zeroDenominatorContributors:
      zeroDenominatorContributors.length > 0
        ? zeroDenominatorContributors
        : undefined,
    steps: [
      {
        operation: 'SUM_NUMERATOR',
        inputs: [`${includedRecordIds.length} bản ghi hợp lệ`],
        output: numSum.toString(),
        inputUnit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        outputUnit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        reason:
          zeroDenominatorContributors.length > 0
            ? `Cộng tử số bao gồm cả ${zeroDenominatorContributors.length} dòng có mẫu số = 0 (đóng góp ${zeroDenominatorContributors
                .reduce((a, b) => a.plus(new Decimal(b.numeratorExactDecimal)), new Decimal(0))
                .toString()} triệu đồng theo R04)`
            : 'Cộng toàn bộ tử số hợp lệ trong phạm vi',
      },
      {
        operation: 'SUM_DENOMINATOR',
        inputs: [`${includedRecordIds.length} bản ghi hợp lệ`],
        output: denSum.toString(),
        inputUnit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        outputUnit: dataset.sourceType === 'GPMB' ? 'm2' : 'million_vnd',
        reason: 'Cộng toàn bộ mẫu số hợp lệ trong phạm vi',
      },
      {
        operation: 'RATIO_PERCENT',
        inputs: [numSum.toString(), denSum.toString()],
        output: exactPercent ? exactPercent.toString() : null,
        inputUnit: 'ratio',
        outputUnit: 'percent',
        reason: 'Chia tổng tử số cho tổng mẫu số và nhân 100 (không lấy AVERAGE tỷ lệ)',
      },
      {
        operation: 'ROUND',
        inputs: [exactPercent ? exactPercent.toString() : 'null'],
        output: displayedText,
        inputUnit: 'percent',
        outputUnit: '%',
        reason: `Làm tròn trình bày ROUND_HALF_UP (${decimals} chữ số thập phân)`,
      },
    ],
    quality: {
      status: qualityStatus,
      warningIds: [],
      missingDeclaredAmount: missingDeclaredAreaSum.gt(0)
        ? missingDeclaredAreaSum.toString()
        : undefined,
      coverageRatio: `${presentUnitsCount}/${expectedCount}`,
    },
    sourceRefs,
    createdAt: new Date().toISOString(),
    engineVersion: '2.2.0',
    datasetHashes: [dataset.workbookSha256],
  };

  return {
    exactPercent,
    exactRatio,
    numeratorSum: numSum,
    denominatorSum: denSum,
    displayedText,
    scopeLabel,
    trace,
  };
}

/**
 * Computes average capital plan per locality: SUM(F13:F126) / 114 (T02)
 */
export function computeDisbPlanPerUnitBenchmark(
  disbDataset: Dataset,
  moneyUnit: 'billion' | 'million' = 'billion',
  decimals = 2
): {
  exactMillion: Decimal;
  exactDisplayUnit: Decimal;
  displayedText: string;
  trace: CalculationTrace;
} {
  let sumF = new Decimal(0);
  const includedIds: string[] = [];
  const sourceRefs: SourceCellRef[] = [];

  for (const rec of disbDataset.records) {
    const fCell = rec.metrics['adjusted_total_plan'];
    if (fCell && (fCell.state === 'VALUE' || fCell.state === 'ZERO') && fCell.normalizedDecimal) {
      sumF = sumF.plus(new Decimal(fCell.normalizedDecimal));
      includedIds.push(rec.id);
      sourceRefs.push(makeSourceCellRef(disbDataset, fCell));
    }
  }

  const count = includedIds.length;
  const avgMillion = count > 0 ? sumF.div(count) : new Decimal(0);
  const avgDisplay =
    moneyUnit === 'billion' ? millionToBillion(avgMillion) : avgMillion;
  const unitText = moneyUnit === 'billion' ? 'tỷ đồng' : 'triệu đồng';
  const displayedText = `${formatVnNumber(avgDisplay, decimals)} ${unitText}`;
  const disbProfile = getDisbSchemaProfile(disbDataset.schemaFingerprint);
  const planCol = disbProfile.planCol;
  const planRange = formatDisbRange(planCol, disbProfile, count);

  const trace: CalculationTrace = {
    traceId: `TRACE_BM_DISB_PLAN_PER_UNIT_${disbDataset.id}`,
    indicatorId: 'DISB_PLAN_PER_UNIT',
    resultKind: 'CALCULATED',
    result: {
      exactDecimal: avgDisplay.toString(),
      displayedText,
      canonicalUnit: moneyUnit === 'billion' ? 'billion_vnd' : 'million_vnd',
      displayUnit: unitText,
      state: 'VALUE',
    },
    formula: {
      formulaId: 'DISB_MEAN_PLAN_PER_LOCALITY',
      formulaVersion: '2.2',
      readableExpression: `SUM(${planRange}) / ${count}${moneyUnit === 'billion' ? ' / 1000' : ''}`,
      expressionTree: { op: 'DIV', lhs: `SUM(${planCol})`, rhs: count },
      method: 'MEAN_ABSOLUTE_PER_UNIT',
      roundingPolicy: `ROUND_HALF_UP_${decimals}`,
      tolerancePolicy: 'EXACT_DECIMAL',
    },
    scope: {
      type: 'LOCALITIES_FULL_114',
      sourceDatasetIds: [disbDataset.id],
      selectedLocalityIds: [],
      expectedCount: 114,
      matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
      asOfDates: [disbDataset.asOfDate],
    },
    operands: [
      {
        role: 'sum_plan_million',
        fieldId: 'adjusted_total_plan',
        exactValue: sumF.toString(),
        unit: 'million_vnd',
        state: 'VALUE',
        sources: sourceRefs.slice(0, 15),
      },
    ],
    population: {
      eligibleCount: 114,
      includedCount: count,
      excludedCount: 0,
      missingCount: 0,
      includedRecordIds: includedIds,
      excludedRecordIds: [],
    },
    coverageDetails: [],
    exclusions: [],
    steps: [
      {
        operation: 'SUM',
        inputs: [`${count} dòng ${planRange}`],
        output: sumF.toString(),
        inputUnit: 'million_vnd',
        outputUnit: 'million_vnd',
        reason: 'Cộng tổng kế hoạch vốn sau điều chỉnh của 114 địa phương',
      },
      {
        operation: 'DIVIDE_BY_UNIT_COUNT',
        inputs: [sumF.toString(), String(count)],
        output: avgMillion.toString(),
        inputUnit: 'million_vnd',
        outputUnit: 'million_vnd',
        reason: 'Chia tổng kế hoạch vốn cho 114 địa phương (mức vốn bình quân tuyệt đối)',
      },
      {
        operation: 'UNIT_CONVERSION',
        inputs: [avgMillion.toString()],
        output: avgDisplay.toString(),
        inputUnit: 'million_vnd',
        outputUnit: unitText,
        reason:
          moneyUnit === 'billion'
            ? 'Quy đổi triệu đồng sang tỷ đồng (÷ 1.000)'
            : 'Giữ nguyên triệu đồng',
      },
    ],
    quality: {
      status: 'COMPLETE',
      warningIds: [],
      coverageRatio: `${count}/114`,
    },
    sourceRefs,
    createdAt: new Date().toISOString(),
    engineVersion: '2.2.0',
    datasetHashes: [disbDataset.workbookSha256],
  };

  return {
    exactMillion: avgMillion,
    exactDisplayUnit: avgDisplay,
    displayedText,
    trace,
  };
}

export interface EvaluatedReportCell {
  traceId: string;
  indicatorId: string;
  localityId: string;
  localityName: string;
  exactDecimal: string | null;
  numericValueForExcel: number | null;
  excelFormatType: 'MONEY' | 'PERCENT_RATIO' | 'AREA' | 'TEXT';
  displayedText: string;
  unitLabel: string;
  state: ValueState;
  qualityStatus: CalculationQuality;
  hasWarning: boolean;
  warningCount: number;
  officialNote?: string | null;
  inspectionMarker?: string | null;
  adjustmentNote?: string | null;
  trace: CalculationTrace;
}

function buildBenchmarkReportCell(params: {
  bm: ReturnType<typeof computeBenchmarkRatio>;
  indicatorId: string;
  locality: Locality;
  qualityStatus?: CalculationQuality;
}): EvaluatedReportCell {
  const { bm, indicatorId, locality, qualityStatus } = params;
  return {
    traceId: bm.trace.traceId,
    indicatorId,
    localityId: locality.id,
    localityName: locality.canonicalNameNFC,
    exactDecimal: bm.exactPercent ? bm.exactPercent.toString() : null,
    numericValueForExcel: bm.exactRatio ? bm.exactRatio.toNumber() : null,
    excelFormatType: 'PERCENT_RATIO',
    displayedText: bm.displayedText,
    unitLabel: '%',
    state: bm.trace.result.state,
    qualityStatus: qualityStatus ?? bm.trace.quality.status,
    hasWarning: false,
    warningCount: 0,
    trace: bm.trace,
  };
}

export function evaluateLocalityIndicator(params: {
  indicator: IndicatorDefinition;
  locality: Locality;
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
  baselineLocalities: Locality[];
  session: ReportSession;
  precomputedBenchmarks?: {
    disbPlanAvg?: ReturnType<typeof computeDisbPlanPerUnitBenchmark>;
    disbRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    revRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    gpmbRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
  };
}): EvaluatedReportCell {
  const {
    indicator,
    locality,
    datasets,
    baselineLocalities,
    session,
    precomputedBenchmarks,
  } = params;

  const moneyUnit = session.settings.moneyUnit;
  const areaUnit = session.settings.areaUnit;
  const decMoney = session.settings.decimalsMoney ?? session.settings.decimals ?? 2;
  const decPct = session.settings.decimalsPercent ?? session.settings.decimals ?? 2;
  const decArea =
    areaUnit === 'ha'
      ? 3
      : session.settings.decimalsArea ?? 0;

  // Check manual override first
  const manualOverride = session.overrides.find(
    (o) => o.indicatorId === indicator.id && o.localityId === locality.id
  );
  void manualOverride;

  // 1. Benchmark rows (DISB_BENCHMARK_RATE, GPMB_BENCHMARK_AREA_RATE, optional REV_BENCHMARK_RATE)
  if (indicator.id === 'DISB_BENCHMARK_RATE') {
    const disb = datasets.DISB!;
    const bm =
      precomputedBenchmarks?.disbRateBenchmark ??
      computeBenchmarkRatio({
        indicatorId: 'DISB_BENCHMARK_RATE',
        dataset: disb,
        baselineLocalities,
        numeratorField: 'disbursed_total',
        denominatorField: 'adjusted_total_plan',
        scopeType: 'LOCALITIES_FULL_114',
        decimals: decPct,
      });

    return buildBenchmarkReportCell({ bm, indicatorId: indicator.id, locality });
  }

  if (indicator.id === 'REV_BENCHMARK_RATE') {
    const rev = datasets.REV!;
    const isFullCoverage =
      baselineLocalities.length > 0 && rev.unitCount >= baselineLocalities.length;
    const bm =
      precomputedBenchmarks?.revRateBenchmark ??
      computeBenchmarkRatio({
        indicatorId: 'REV_RATE_Y',
        dataset: rev,
        baselineLocalities,
        numeratorField: 'actual_total_revenue',
        denominatorField: 'annual_total_budget',
        scopeType: isFullCoverage ? 'LOCALITIES_FULL_114' : 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      });

    return buildBenchmarkReportCell({
      bm,
      indicatorId: indicator.id,
      locality,
      qualityStatus: isFullCoverage ? bm.trace.quality.status : 'PARTIAL_AGGREGATE',
    });
  }

  if (indicator.id === 'GPMB_BENCHMARK_AREA_RATE') {
    const gpmb = datasets.GPMB!;
    const bm =
      precomputedBenchmarks?.gpmbRateBenchmark ??
      computeBenchmarkRatio({
        indicatorId: 'GPMB_BENCHMARK_AREA_RATE',
        dataset: gpmb,
        baselineLocalities,
        numeratorField: 'gpmb_recorded_area',
        denominatorField: 'gpmb_declared_area',
        scopeType: 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      });

    return buildBenchmarkReportCell({
      bm,
      indicatorId: indicator.id,
      locality,
      qualityStatus: 'PARTIAL_AGGREGATE',
    });
  }

  if (indicator.id === 'DISB_PLAN_PER_UNIT') {
    const disb = datasets.DISB!;
    const avg =
      precomputedBenchmarks?.disbPlanAvg ??
      computeDisbPlanPerUnitBenchmark(disb, moneyUnit, decMoney);
    return {
      traceId: avg.trace.traceId,
      indicatorId: indicator.id,
      localityId: locality.id,
      localityName: locality.canonicalNameNFC,
      exactDecimal: avg.exactDisplayUnit.toString(),
      numericValueForExcel: avg.exactDisplayUnit.toNumber(),
      excelFormatType: 'MONEY',
      displayedText: formatVnNumber(avg.exactDisplayUnit, decMoney),
      unitLabel: moneyUnit === 'billion' ? 'tỷ đồng' : 'triệu đồng',
      state: 'VALUE',
      qualityStatus: 'COMPLETE',
      hasWarning: false,
      warningCount: 0,
      trace: avg.trace,
    };
  }

  // 2. REV Indicators
  if (indicator.sourceType === 'REV') {
    const rev = datasets.REV!;
    const rec = rev.records.find((r) => r.localityId === locality.id);

    if (!rec) {
      const covDetail: CoverageDetail = {
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        sourceDatasetId: rev.id,
        sourceType: 'REV',
        fieldId: indicator.id,
        status: 'NO_LOCALITY_RECORD',
        reason: `Địa phương "${locality.canonicalNameNFC}" không có bản ghi trong nguồn Thu NSNN (${rev.sourceSheet}). Không tự gán 0.`,
        sourceSheet: rev.sourceSheet,
        asOfDate: rev.asOfDate || 'UNCONFIRMED',
        impactOnComputation: 'Hiển thị trạng thái thiếu bản ghi nguồn (NO_LOCALITY_RECORD).',
      };
      const traceId = `TRACE_${indicator.id}_${locality.id}_MISSING_RECORD`;
      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: null,
          displayedText: 'Chưa có bản ghi nguồn (NO_LOCALITY_RECORD)',
          canonicalUnit: indicator.displayUnit,
          displayUnit: indicator.displayUnit,
          state: 'OUT_OF_SCOPE',
        },
        formula: {
          formulaId: indicator.id,
          formulaVersion: '2.2',
          readableExpression: indicator.fieldOrFormula,
          expressionTree: { op: 'LOOKUP', locality: locality.canonicalNameNFC },
          method: indicator.aggregationPolicy,
          roundingPolicy: `ROUND_HALF_UP_${decPct}`,
          tolerancePolicy: 'EXACT',
        },
        scope: {
          type: 'SINGLE_LOCALITY',
          sourceDatasetIds: [rev.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [rev.asOfDate || 'UNCONFIRMED'],
        },
        operands: [],
        population: {
          eligibleCount: 1,
          includedCount: 0,
          excludedCount: 1,
          missingCount: 1,
          includedRecordIds: [],
          excludedRecordIds: [locality.id],
        },
        coverageDetails: [covDetail],
        exclusions: [
          {
            recordId: locality.id,
            affectedOperand: 'record',
            reasonCode: 'SOURCE_NOT_PRESENT',
            explanation: covDetail.reason,
          },
        ],
        steps: [],
        quality: {
          status: 'INSUFFICIENT_COMPONENTS',
          warningIds: [],
        },
        sourceRefs: [],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [rev.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: null,
        numericValueForExcel: null,
        excelFormatType: 'TEXT',
        displayedText: 'Chưa có bản ghi nguồn',
        unitLabel: '',
        state: 'OUT_OF_SCOPE',
        qualityStatus: 'INSUFFICIENT_COMPONENTS',
        hasWarning: true,
        warningCount: 1,
        trace,
      };
    }

    // Do not turn a blank/error numerator or denominator into numeric zero.
    const requiredFields = [indicator.numeratorField,indicator.denominatorField].filter((x):x is string=>Boolean(x));
    const invalidField = requiredFields.find(field=>{
      const m=rec.metrics[field];
      return !m || (m.state!=='VALUE'&&m.state!=='ZERO') || m.normalizedDecimal===null;
    });
    if (invalidField && rec.metrics[invalidField]) {
      const bad=rec.metrics[invalidField];
      const sourceTrace=buildSourceValueTrace(rev,rec,invalidField);
      const qualityStatus:CalculationQuality=bad.state==='FORMULA_ERROR'||bad.state==='INVALID'?'SOURCE_ERROR':'INSUFFICIENT_COMPONENTS';
      const displayedText=bad.state==='FORMULA_ERROR'?'Lỗi công thức nguồn':'Chưa có số liệu';
      const traceId='TRACE_'+indicator.id+'_'+locality.id+'_'+rev.id+'_INVALID_INPUT';
      const trace:CalculationTrace={
        ...sourceTrace, traceId,indicatorId:indicator.id,
        resultKind:'CALCULATED',
        result:{...sourceTrace.result,exactDecimal:null,displayedText,state:bad.state},
        formula:{...sourceTrace.formula,formulaId:indicator.id,readableExpression:'Không tính: trường '+invalidField+' chưa có giá trị hợp lệ',method:'INVALID_OR_MISSING_INPUT'},
        population:{...sourceTrace.population,includedCount:0,excludedCount:1,includedRecordIds:[],excludedRecordIds:[rec.id]},
        exclusions:[{recordId:rec.id,affectedOperand:invalidField,reasonCode:bad.state==='FORMULA_ERROR'?'FORMULA_ERROR':'MISSING_INPUT',explanation:'Không chuyển giá trị thiếu/lỗi thành 0.',sourceCell:bad.provenance.cell,sourceValue:bad.raw==null?null:String(bad.raw)}],
        quality:{status:qualityStatus,warningIds:[]},
      };
      return {traceId,indicatorId:indicator.id,localityId:locality.id,localityName:locality.canonicalNameNFC,exactDecimal:null,numericValueForExcel:null,excelFormatType:'TEXT',displayedText,unitLabel:'',state:bad.state,qualityStatus,hasWarning:true,warningCount:1,trace};
    }
    // Direct money indicator (REV_BUDGET_Y, REV_REALIZED)
    if (indicator.aggregationPolicy === 'DIRECT_UNIT_CONVERSION' && indicator.numeratorField) {
      const mCell = rec.metrics[indicator.numeratorField];
      const ref = makeSourceCellRef(rev, mCell);
      const rawMillion = new Decimal(mCell.normalizedDecimal || '0');
      const converted =
        moneyUnit === 'billion' ? millionToBillion(rawMillion) : rawMillion;
      const unitLabel = moneyUnit === 'billion' ? 'tỷ đồng' : 'triệu đồng';
      const displayedText = formatVnNumber(converted, decMoney);
      const traceId = `TRACE_${indicator.id}_${locality.id}_${rev.id}`;

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: converted.toString(),
          displayedText,
          canonicalUnit: moneyUnit === 'billion' ? 'billion_vnd' : 'million_vnd',
          displayUnit: unitLabel,
          state: mCell.state,
        },
        formula: {
          formulaId: `${indicator.id}_UNIT_CONV`,
          formulaVersion: '2.2',
          readableExpression:
            moneyUnit === 'billion'
              ? `${ref.address} (triệu đồng) / 1000 = ${converted.toString()} tỷ đồng`
              : `${ref.address} = ${converted.toString()} triệu đồng`,
          expressionTree: { op: 'DIV', lhs: ref.address, rhs: moneyUnit === 'billion' ? 1000 : 1 },
          method: 'UNIT_CONVERSION',
          roundingPolicy: `ROUND_HALF_UP_${decMoney}`,
          tolerancePolicy: 'EXACT_DECIMAL',
        },
        scope: {
          type: 'SINGLE_LOCALITY',
          sourceDatasetIds: [rev.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [rev.asOfDate || 'UNCONFIRMED'],
        },
        operands: [
          {
            role: 'source_million',
            fieldId: indicator.numeratorField,
            exactValue: mCell.normalizedDecimal,
            unit: 'million_vnd',
            state: mCell.state,
            sources: [ref],
          },
        ],
        population: {
          eligibleCount: 1,
          includedCount: 1,
          excludedCount: 0,
          missingCount: 0,
          includedRecordIds: [rec.id],
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'READ_SOURCE',
            inputs: [`${ref.sheetName}!${ref.address}`],
            output: rawMillion.toString(),
            inputUnit: 'million_vnd',
            outputUnit: 'million_vnd',
            reason: 'Đọc giá trị gốc triệu đồng từ nguồn Thu NSNN',
          },
          {
            operation: 'UNIT_CONVERSION',
            inputs: [rawMillion.toString()],
            output: converted.toString(),
            inputUnit: 'million_vnd',
            outputUnit: unitLabel,
            reason:
              moneyUnit === 'billion'
                ? `${rawMillion.toString()} triệu / 1000 = ${converted.toString()} tỷ`
                : 'Giữ nguyên triệu đồng',
          },
          {
            operation: 'ROUND',
            inputs: [converted.toString()],
            output: displayedText,
            inputUnit: unitLabel,
            outputUnit: unitLabel,
            reason: `Làm tròn trình bày ${decMoney} chữ số thập phân`,
          },
        ],
        quality: {
          status: 'COMPLETE',
          warningIds: [],
        },
        sourceRefs: [ref],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [rev.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: converted.toString(),
        numericValueForExcel: converted.toNumber(),
        excelFormatType: 'MONEY',
        displayedText,
        unitLabel,
        state: mCell.state,
        qualityStatus: 'COMPLETE',
        hasWarning: false,
        warningCount: 0,
        trace,
      };
    }

    // REV Ratio indicator (REV_RATE_Y, REV_LAND_RATE_Y, REV_NONLAND_RATE_Y, REV_RATE_P, REV_LAND_RATE_P, REV_NONLAND_RATE_P)
    const numCell = rec.metrics[indicator.numeratorField!];
    const denCell = rec.metrics[indicator.denominatorField!];
    const numRef = makeSourceCellRef(rev, numCell);
    const denRef = makeSourceCellRef(rev, denCell);
    const numDec = new Decimal(numCell.normalizedDecimal || '0');
    const denDec = new Decimal(denCell.normalizedDecimal || '0');
    const traceId = `TRACE_${indicator.id}_${locality.id}_${rev.id}`;

    const isPeriodPlan = indicator.id.endsWith('_P');
    let exactPct: Decimal | null = null;
    let exactRatio: Decimal | null = null;
    let displayedText = '';
    let state: ValueState = 'VALUE';
    let qualityStatus: CalculationQuality = 'COMPLETE';
    const coverageDetails: CoverageDetail[] = [];

    if (denDec.isZero()) {
      qualityStatus = 'DENOMINATOR_ZERO';
      state = 'NOT_APPLICABLE';
      if (numDec.gt(0)) {
        displayedText = isPeriodPlan
          ? 'Phát sinh ngoài kế hoạch'
          : 'Phát sinh ngoài dự toán';
      } else {
        displayedText = 'Không có cơ sở tính tỷ lệ';
      }
      coverageDetails.push({
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        sourceDatasetId: rev.id,
        sourceType: 'REV',
        fieldId: indicator.denominatorField,
        status: 'ZERO_VALID',
        reason: `Mẫu số ${denRef.address}=0 hợp lệ, tử số ${numRef.address}=${numDec.toString()} triệu đồng. Cấp địa phương hiển thị "${displayedText}", nhưng khi tính benchmark tổng/tổng vẫn đóng góp ${numDec.toString()} triệu vào tử số (R04).`,
        sourceSheet: rev.sourceSheet,
        sourceCell: denRef.address,
        asOfDate: rev.asOfDate || 'UNCONFIRMED',
        impactOnComputation: 'Không chia cho 0 ở cấp xã; vẫn cộng vào tổng tử số của mốc chung.',
      });
    } else {
      exactRatio = numDec.div(denDec);
      exactPct = exactRatio.mul(100);
      displayedText = formatVnPercent(exactPct, decPct);
    }

    const trace: CalculationTrace = {
      traceId,
      indicatorId: indicator.id,
      localityId: locality.id,
      localityName: locality.canonicalNameNFC,
      resultKind: 'CALCULATED',
      result: {
        exactDecimal: exactPct ? exactPct.toString() : null,
        displayedText,
        canonicalUnit: 'percent',
        displayUnit: '%',
        state,
      },
      formula: {
        formulaId: indicator.id,
        formulaVersion: '2.2',
        readableExpression: `${numRef.address} / ${denRef.address} * 100`,
        expressionTree: { op: 'MUL', lhs: { op: 'DIV', num: numRef.address, den: denRef.address }, rhs: 100 },
        method: 'LOCALITY_RATIO',
        roundingPolicy: `ROUND_HALF_UP_${decPct}`,
        tolerancePolicy: 'EXACT_DECIMAL',
      },
      scope: {
        type: 'SINGLE_LOCALITY',
        sourceDatasetIds: [rev.id],
        selectedLocalityIds: [locality.id],
        matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
        asOfDates: [rev.asOfDate || 'UNCONFIRMED'],
      },
      operands: [
        {
          role: 'numerator',
          fieldId: indicator.numeratorField!,
          exactValue: numDec.toString(),
          unit: 'million_vnd',
          state: numCell.state,
          sources: [numRef],
        },
        {
          role: 'denominator',
          fieldId: indicator.denominatorField!,
          exactValue: denDec.toString(),
          unit: 'million_vnd',
          state: denCell.state,
          sources: [denRef],
        },
      ],
      population: {
        eligibleCount: 1,
        includedCount: 1,
        excludedCount: 0,
        missingCount: 0,
        includedRecordIds: [rec.id],
        excludedRecordIds: [],
      },
      coverageDetails,
      exclusions: [],
      steps: [
        {
          operation: 'DIVIDE_LOCALITY_RATIO',
          inputs: [numDec.toString(), denDec.toString()],
          output: exactPct ? exactPct.toString() : null,
          inputUnit: 'million_vnd',
          outputUnit: 'percent',
          reason: denDec.isZero()
            ? `Mẫu số ${denRef.address}=0 nên không thực hiện phép chia cấp địa phương (${displayedText})`
            : `Chia ${numRef.address} (${numDec.toString()}) cho ${denRef.address} (${denDec.toString()}) × 100`,
        },
      ],
      quality: {
        status: qualityStatus,
        warningIds: [],
      },
      sourceRefs: [numRef, denRef],
      createdAt: new Date().toISOString(),
      engineVersion: '2.2.0',
      datasetHashes: [rev.workbookSha256],
    };

    return {
      traceId,
      indicatorId: indicator.id,
      localityId: locality.id,
      localityName: locality.canonicalNameNFC,
      exactDecimal: exactPct ? exactPct.toString() : null,
      numericValueForExcel: exactRatio ? exactRatio.toNumber() : null,
      excelFormatType: exactRatio ? 'PERCENT_RATIO' : 'TEXT',
      displayedText,
      unitLabel: exactRatio ? '%' : '',
      state,
      qualityStatus,
      hasWarning: denDec.isZero(),
      warningCount: denDec.isZero() ? 1 : 0,
      trace,
    };
  }

  // 3. DISB Indicators
  if (indicator.sourceType === 'DISB') {
    const disb = datasets.DISB!;
    const rec = disb.records.find((r) => r.localityId === locality.id);
    if (!rec) {
      throw new Error(`Locality ${locality.id} not found in DISB dataset`);
    }

    if (indicator.aggregationPolicy === 'DIRECT_UNIT_CONVERSION' && indicator.numeratorField) {
      const mCell = rec.metrics[indicator.numeratorField];
      const ref = makeSourceCellRef(disb, mCell);
      const traceId = `TRACE_${indicator.id}_${locality.id}_${disb.id}`;

      if (mCell.state === 'MISSING') {
        const trace: CalculationTrace = {
          traceId,
          indicatorId: indicator.id,
          localityId: locality.id,
          localityName: locality.canonicalNameNFC,
          resultKind: 'CALCULATED',
          result: {
            exactDecimal: null,
            displayedText: 'Chưa có số liệu',
            canonicalUnit: moneyUnit === 'billion' ? 'billion_vnd' : 'million_vnd',
            displayUnit: moneyUnit === 'billion' ? 'tỷ đồng' : 'triệu đồng',
            state: 'MISSING',
          },
          formula: {
            formulaId: `${indicator.id}_UNIT_CONV`,
            formulaVersion: '2.2',
            readableExpression: `${ref.address} (trống -> giữ nguyên MISSING, không gán 0)`,
            expressionTree: { op: 'DIRECT', cell: ref.address },
            method: 'UNIT_CONVERSION',
            roundingPolicy: `ROUND_HALF_UP_${decMoney}`,
            tolerancePolicy: 'EXACT',
          },
          scope: {
            type: 'SINGLE_LOCALITY',
            sourceDatasetIds: [disb.id],
            selectedLocalityIds: [locality.id],
            matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
            asOfDates: [disb.asOfDate],
          },
          operands: [
            {
              role: 'source_million',
              fieldId: indicator.numeratorField,
              exactValue: null,
              unit: 'million_vnd',
              state: 'MISSING',
              sources: [ref],
            },
          ],
          population: {
            eligibleCount: 1,
            includedCount: 0,
            excludedCount: 1,
            missingCount: 1,
            includedRecordIds: [],
            excludedRecordIds: [rec.id],
          },
          coverageDetails: [
            {
              localityId: locality.id,
              localityName: locality.canonicalNameNFC,
              sourceDatasetId: disb.id,
              sourceType: 'DISB',
              fieldId: indicator.numeratorField,
              status: 'FIELD_MISSING',
              reason: `Ô ${ref.address} để trống trong nguồn Giải ngân; giữ trạng thái MISSING khi xem độc lập (T38).`,
              sourceSheet: disb.sourceSheet,
              sourceCell: ref.address,
              asOfDate: disb.asOfDate,
            },
          ],
          exclusions: [
            {
              recordId: rec.id,
              affectedOperand: indicator.numeratorField,
              reasonCode: 'MISSING_INPUT',
              explanation: `Ô ${ref.address} để trống (MISSING).`,
              sourceCell: ref.address,
            },
          ],
          steps: [],
          quality: { status: 'INSUFFICIENT_COMPONENTS', warningIds: [] },
          sourceRefs: [ref],
          createdAt: new Date().toISOString(),
          engineVersion: '2.2.0',
          datasetHashes: [disb.workbookSha256],
        };

        return {
          traceId,
          indicatorId: indicator.id,
          localityId: locality.id,
          localityName: locality.canonicalNameNFC,
          exactDecimal: null,
          numericValueForExcel: null,
          excelFormatType: 'TEXT',
          displayedText: 'Chưa có số liệu',
          unitLabel: '',
          state: 'MISSING',
          qualityStatus: 'INSUFFICIENT_COMPONENTS',
          hasWarning: true,
          warningCount: 1,
          trace,
        };
      }

      const rawMillion = new Decimal(mCell.normalizedDecimal || '0');
      const converted =
        moneyUnit === 'billion' ? millionToBillion(rawMillion) : rawMillion;
      const unitLabel = moneyUnit === 'billion' ? 'tỷ đồng' : 'triệu đồng';
      const displayedText = formatVnNumber(converted, decMoney);

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: converted.toString(),
          displayedText,
          canonicalUnit: moneyUnit === 'billion' ? 'billion_vnd' : 'million_vnd',
          displayUnit: unitLabel,
          state: mCell.state,
        },
        formula: {
          formulaId: `${indicator.id}_UNIT_CONV`,
          formulaVersion: '2.2',
          readableExpression:
            moneyUnit === 'billion'
              ? `${ref.address} (${rawMillion.toString()} triệu) / 1000 = ${converted.toString()} tỷ`
              : `${ref.address} = ${rawMillion.toString()} triệu`,
          expressionTree: { op: 'DIV', lhs: ref.address, rhs: moneyUnit === 'billion' ? 1000 : 1 },
          method: 'UNIT_CONVERSION',
          roundingPolicy: `ROUND_HALF_UP_${decMoney}`,
          tolerancePolicy: 'EXACT_DECIMAL',
        },
        scope: {
          type: 'SINGLE_LOCALITY',
          sourceDatasetIds: [disb.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [disb.asOfDate],
        },
        operands: [
          {
            role: 'source_million',
            fieldId: indicator.numeratorField,
            exactValue: rawMillion.toString(),
            unit: 'million_vnd',
            state: mCell.state,
            sources: [ref],
          },
        ],
        population: {
          eligibleCount: 1,
          includedCount: 1,
          excludedCount: 0,
          missingCount: 0,
          includedRecordIds: [rec.id],
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'UNIT_CONVERSION',
            inputs: [rawMillion.toString()],
            output: converted.toString(),
            inputUnit: 'million_vnd',
            outputUnit: unitLabel,
            reason:
              moneyUnit === 'billion'
                ? `${rawMillion.toString()} triệu / 1000 = ${converted.toString()} tỷ`
                : 'Giữ nguyên triệu đồng',
          },
          {
            operation: 'ROUND',
            inputs: [converted.toString()],
            output: displayedText,
            inputUnit: unitLabel,
            outputUnit: unitLabel,
            reason: `Làm tròn ROUND_HALF_UP ${decMoney} chữ số thập phân`,
          },
        ],
        quality: { status: 'COMPLETE', warningIds: [] },
        sourceRefs: [ref],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [disb.workbookSha256],
      };

      let adjustmentNote: string | null = null;
      if (
        indicator.id === 'DISB_PLAN' &&
        session.settings.showDisbPlanAdjustmentComparison !== false
      ) {
        const initCell = rec.metrics['initial_total_plan'];
        if (initCell && initCell.normalizedDecimal !== null && initCell.normalizedDecimal !== undefined) {
          const initMillion = new Decimal(initCell.normalizedDecimal);
          const diffMillion = rawMillion.minus(initMillion);
          const diffDisplay =
            moneyUnit === 'billion' ? millionToBillion(diffMillion) : diffMillion;
          const unitText = moneyUnit === 'billion' ? ' tỷ' : ' triệu';
          if (diffDisplay.toDecimalPlaces(decMoney, Decimal.ROUND_HALF_UP).isZero()) {
            adjustmentNote = 'giữ nguyên';
          } else if (diffDisplay.gt(0)) {
            adjustmentNote = `tăng ${formatVnNumber(diffDisplay, decMoney)}${unitText}`;
          } else {
            adjustmentNote = `giảm ${formatVnNumber(diffDisplay.abs(), decMoney)}${unitText}`;
          }
        }
      }

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: converted.toString(),
        numericValueForExcel: converted.toNumber(),
        excelFormatType: 'MONEY',
        displayedText,
        unitLabel,
        state: mCell.state,
        qualityStatus: 'COMPLETE',
        hasWarning: false,
        warningCount: 0,
        officialNote: rec.officialNote,
        inspectionMarker: rec.inspectionMarker,
        adjustmentNote,
        trace,
      };
    }

    if (indicator.id === 'DISB_PLAN_VS_AVG_COMMENT') {
      const fCell = rec.metrics['adjusted_total_plan'];
      const fRef = makeSourceCellRef(disb, fCell);
      const fMillion = new Decimal(fCell.normalizedDecimal || '0');
      const avg =
        precomputedBenchmarks?.disbPlanAvg ??
        computeDisbPlanPerUnitBenchmark(disb, moneyUnit, decMoney);
      const diffMillion = fMillion.minus(avg.exactMillion);
      const label = diffMillion.gt(0)
        ? session.comparisonRules.higherLabel
        : diffMillion.lt(0)
        ? session.comparisonRules.lowerLabel
        : session.comparisonRules.equalLabel;
      const traceId = `TRACE_DISB_PLAN_VS_AVG_${locality.id}_${disb.id}`;

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: diffMillion.toString(),
          displayedText: label,
          canonicalUnit: 'million_vnd',
          displayUnit: 'text',
          state: 'VALUE',
        },
        formula: {
          formulaId: 'COMPARE_DISB_PLAN_VS_MEAN_114',
          formulaVersion: '2.2',
          readableExpression: `So sánh ${fRef.address} (${formatVnNumber(
            millionToBillion(fMillion),
            2
          )} tỷ) với mức vốn bình quân 114 địa phương (${formatVnNumber(
            millionToBillion(avg.exactMillion),
            2
          )} tỷ) => "${label}"`,
          expressionTree: {
            op: 'COMPARE',
            lhs: fRef.address,
            rhs: `SUM(${formatDisbRange(
              getDisbSchemaProfile(disb.schemaFingerprint).planCol,
              getDisbSchemaProfile(disb.schemaFingerprint),
              114
            )})/114`,
          },
          method: 'COMPARISON_RULE',
          roundingPolicy: 'EXACT_DECIMAL_BEFORE_COMPARE',
          tolerancePolicy: '0',
        },
        scope: {
          type: 'LOCALITY_VS_LOCALITIES_FULL_114',
          sourceDatasetIds: [disb.id],
          selectedLocalityIds: [locality.id],
          expectedCount: 114,
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [disb.asOfDate],
        },
        operands: [
          {
            role: 'locality_plan_million',
            fieldId: 'adjusted_total_plan',
            exactValue: fMillion.toString(),
            unit: 'million_vnd',
            state: fCell.state,
            sources: [fRef],
          },
          {
            role: 'benchmark_mean_plan_million',
            fieldId: 'DISB_PLAN_PER_UNIT',
            exactValue: avg.exactMillion.toString(),
            unit: 'million_vnd',
            state: 'VALUE',
            sources: avg.trace.sourceRefs.slice(0, 10),
          },
        ],
        population: {
          eligibleCount: 114,
          includedCount: 114,
          excludedCount: 0,
          missingCount: 0,
          includedRecordIds: avg.trace.population.includedRecordIds,
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'SUBTRACT',
            inputs: [fMillion.toString(), avg.exactMillion.toString()],
            output: diffMillion.toString(),
            inputUnit: 'million_vnd',
            outputUnit: 'million_vnd',
            reason: 'Chênh lệch vốn giao của địa phương so với vốn bình quân 114 địa phương',
          },
          {
            operation: 'CLASSIFY_LABEL',
            inputs: [diffMillion.toString()],
            output: label,
            reason: `Áp dụng ngưỡng so sánh => "${label}"`,
          },
        ],
        quality: { status: 'COMPLETE', warningIds: [] },
        sourceRefs: [fRef],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [disb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: diffMillion.toString(),
        numericValueForExcel: null,
        excelFormatType: 'TEXT',
        displayedText: label,
        unitLabel: '',
        state: 'VALUE',
        qualityStatus: 'COMPLETE',
        hasWarning: false,
        warningCount: 0,
        trace,
      };
    }

    if (indicator.id === 'DISB_RATE') {
      const iCell = rec.metrics['disbursed_total'];
      const fCell = rec.metrics['adjusted_total_plan'];
      const iRef = makeSourceCellRef(disb, iCell);
      const fRef = makeSourceCellRef(disb, fCell);
      const iDec = new Decimal(iCell.normalizedDecimal || '0');
      const fDec = new Decimal(fCell.normalizedDecimal || '0');
      const ratio = iDec.div(fDec);
      const pct = ratio.mul(100);
      const displayedText = formatVnPercent(pct, decPct);
      const traceId = `TRACE_DISB_RATE_${locality.id}_${disb.id}`;
      const disbProfile = getDisbSchemaProfile(disb.schemaFingerprint);
      const ratioSymbol = `${disbProfile.disbCol}/${disbProfile.planCol}`;

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: pct.toString(),
          displayedText,
          canonicalUnit: 'percent',
          displayUnit: '%',
          state: 'VALUE',
        },
        formula: {
          formulaId: 'DISB_RATE_LOCALITY',
          formulaVersion: '2.2',
          readableExpression: `${iRef.address} / ${fRef.address} * 100${
            rec.officialNote
              ? ` (Có ghi chú ${disbProfile.noteCol}${rec.sourceRow} nguyên văn, kịch bản điều chỉnh chưa xác minh tử/mẫu nên không tự thay tỷ lệ ${ratioSymbol})`
              : ''
          }`,
          expressionTree: { op: 'MUL', lhs: { op: 'DIV', num: iRef.address, den: fRef.address }, rhs: 100 },
          method: 'RATIO_OF_SUMS',
          roundingPolicy: `ROUND_HALF_UP_${decPct}`,
          tolerancePolicy: 'EXACT_DECIMAL',
        },
        scope: {
          type: 'SINGLE_LOCALITY',
          sourceDatasetIds: [disb.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [disb.asOfDate],
        },
        operands: [
          {
            role: 'numerator',
            fieldId: 'disbursed_total',
            exactValue: iDec.toString(),
            unit: 'million_vnd',
            state: iCell.state,
            sources: [iRef],
          },
          {
            role: 'denominator',
            fieldId: 'adjusted_total_plan',
            exactValue: fDec.toString(),
            unit: 'million_vnd',
            state: fCell.state,
            sources: [fRef],
          },
        ],
        population: {
          eligibleCount: 1,
          includedCount: 1,
          excludedCount: 0,
          missingCount: 0,
          includedRecordIds: [rec.id],
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'DIVIDE_RATIO',
            inputs: [iDec.toString(), fDec.toString()],
            output: pct.toString(),
            inputUnit: 'million_vnd',
            outputUnit: 'percent',
            reason: `Tính lại tỷ lệ giải ngân từ ${iRef.address}/${fRef.address} × 100`,
          },
          {
            operation: 'ROUND',
            inputs: [pct.toString()],
            output: displayedText,
            inputUnit: 'percent',
            outputUnit: '%',
            reason: `Làm tròn ROUND_HALF_UP ${decPct} chữ số thập phân`,
          },
        ],
        quality: {
          status: 'COMPLETE',
          warningIds: rec.officialNote
            ? [`NOTE_${getDisbSchemaProfile(disb.schemaFingerprint).noteCol}${rec.sourceRow}`]
            : [],
        },
        sourceRefs: [iRef, fRef],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [disb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: pct.toString(),
        numericValueForExcel: ratio.toNumber(),
        excelFormatType: 'PERCENT_RATIO',
        displayedText,
        unitLabel: '%',
        state: 'VALUE',
        qualityStatus: 'COMPLETE',
        hasWarning: Boolean(rec.officialNote),
        warningCount: rec.officialNote ? 1 : 0,
        officialNote: rec.officialNote,
        inspectionMarker: rec.inspectionMarker,
        trace,
      };
    }

    if (indicator.id === 'DISB_COMPARISON_LABEL') {
      const rateCell = evaluateLocalityIndicator({
        indicator: DEFAULT_INDICATORS['DISB_RATE'],
        locality,
        datasets,
        baselineLocalities,
        session,
        precomputedBenchmarks,
      });
      const bm =
        precomputedBenchmarks?.disbRateBenchmark ??
        computeBenchmarkRatio({
          indicatorId: 'DISB_BENCHMARK_RATE',
          dataset: disb,
          baselineLocalities,
          numeratorField: 'disbursed_total',
          denominatorField: 'adjusted_total_plan',
          scopeType: 'LOCALITIES_FULL_114',
          decimals: decPct,
        });

      const locPct = new Decimal(rateCell.exactDecimal || '0');
      const bmPct = bm.exactPercent!;
      const diffPp = locPct.minus(bmPct);
      const diffFormatted = formatVnNumber(diffPp.abs(), decPct);
      const label = diffPp.gt(session.comparisonRules.higherThresholdPp)
        ? `${session.comparisonRules.higherLabel} (>${diffFormatted}%)`
        : diffPp.lt(-session.comparisonRules.lowerThresholdPp)
        ? `${session.comparisonRules.lowerLabel} (<${diffFormatted}%)`
        : `${session.comparisonRules.equalLabel} (0,00%)`;

      const traceId = `TRACE_DISB_COMPARISON_${locality.id}_${disb.id}`;
      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: diffPp.toString(),
          displayedText: label,
          canonicalUnit: 'percentage_points',
          displayUnit: 'text',
          state: 'VALUE',
        },
        formula: {
          formulaId: 'DISB_RATE_VS_BENCHMARK_114',
          formulaVersion: '2.2',
          readableExpression: `Chênh lệch điểm % = ${formatVnPercent(locPct, 2)} - ${formatVnPercent(
            bmPct,
            2
          )} = ${formatVnNumber(diffPp, 2)} điểm % => "${label}"`,
          expressionTree: { op: 'SUB', lhs: 'DISB_RATE_i', rhs: 'DISB_BENCHMARK_RATE' },
          method: 'PERCENT_POINT_DIFF',
          roundingPolicy: 'EXACT_DECIMAL_BEFORE_COMPARE',
          tolerancePolicy: '0',
        },
        scope: {
          type: 'LOCALITY_VS_LOCALITIES_FULL_114',
          sourceDatasetIds: [disb.id],
          selectedLocalityIds: [locality.id],
          expectedCount: 114,
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [disb.asOfDate],
        },
        operands: [
          {
            role: 'locality_rate_pct',
            fieldId: 'DISB_RATE',
            exactValue: locPct.toString(),
            unit: 'percent',
            state: 'VALUE',
            sources: rateCell.trace.sourceRefs,
          },
          {
            role: 'benchmark_rate_pct',
            fieldId: 'DISB_BENCHMARK_RATE',
            exactValue: bmPct.toString(),
            unit: 'percent',
            state: 'VALUE',
            sources: bm.trace.sourceRefs.slice(0, 10),
          },
        ],
        population: {
          eligibleCount: 114,
          includedCount: 114,
          excludedCount: 0,
          missingCount: 0,
          includedRecordIds: bm.trace.population.includedRecordIds,
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'PERCENT_POINT_DIFF',
            inputs: [locPct.toString(), bmPct.toString()],
            output: diffPp.toString(),
            inputUnit: 'percent',
            outputUnit: 'percentage_points',
            reason: `Tính chênh lệch điểm phần trăm giữa tỷ lệ địa phương và mốc 114 địa phương (${formatVnPercent(
              bmPct,
              decPct
            )})`,
          },
          {
            operation: 'CLASSIFY_LABEL',
            inputs: [diffPp.toString()],
            output: label,
            reason: `Áp dụng quy tắc nhận xét => "${label}"`,
          },
        ],
        quality: { status: 'COMPLETE', warningIds: [] },
        sourceRefs: rateCell.trace.sourceRefs,
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [disb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: diffPp.toString(),
        numericValueForExcel: null,
        excelFormatType: 'TEXT',
        displayedText: label,
        unitLabel: '',
        state: 'VALUE',
        qualityStatus: 'COMPLETE',
        hasWarning: false,
        warningCount: 0,
        trace,
      };
    }
  }

  // 4. GPMB Indicators
  if (indicator.sourceType === 'GPMB') {
    const gpmb = datasets.GPMB!;
    const projRecords = gpmb.records.filter((r) => r.localityId === locality.id);
    const hasLocalityInGpmb =
      Boolean(gpmb.localityGroupSummaries?.[locality.id]) || projRecords.length > 0;

    if (!hasLocalityInGpmb) {
      const covDetail: CoverageDetail = {
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        sourceDatasetId: gpmb.id,
        sourceType: 'GPMB',
        fieldId: indicator.id,
        status: 'NO_LOCALITY_RECORD',
        reason: `Địa bàn "${locality.canonicalNameNFC}" ghi nhận mặc định không có số liệu (Không có nhiệm vụ GPMB).`,
        sourceSheet: gpmb.sourceSheet,
        asOfDate: gpmb.asOfDate,
        impactOnComputation: 'Hiển thị "Không có nhiệm vụ GPMB" trong Bảng tổng hợp.',
      };
      const traceId = `TRACE_${indicator.id}_${locality.id}_NO_RECORD`;
      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: null,
          displayedText: 'Không có nhiệm vụ GPMB',
          canonicalUnit: indicator.displayUnit,
          displayUnit: indicator.displayUnit,
          state: 'OUT_OF_SCOPE',
        },
        formula: {
          formulaId: indicator.id,
          formulaVersion: '2.2',
          readableExpression: indicator.fieldOrFormula,
          expressionTree: { op: 'LOOKUP_GPMB', locality: locality.canonicalNameNFC },
          method: indicator.aggregationPolicy,
          roundingPolicy: 'NONE',
          tolerancePolicy: 'EXACT',
        },
        scope: {
          type: 'SINGLE_LOCALITY_PROJECTS',
          sourceDatasetIds: [gpmb.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [gpmb.asOfDate],
        },
        operands: [],
        population: {
          eligibleCount: 0,
          includedCount: 0,
          excludedCount: 1,
          missingCount: 1,
          includedRecordIds: [],
          excludedRecordIds: [locality.id],
        },
        coverageDetails: [covDetail],
        exclusions: [
          {
            recordId: locality.id,
            affectedOperand: 'locality_group',
            reasonCode: 'SOURCE_NOT_PRESENT',
            explanation: covDetail.reason,
          },
        ],
        steps: [],
        quality: { status: 'INSUFFICIENT_COMPONENTS', warningIds: [] },
        sourceRefs: [],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [gpmb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: null,
        numericValueForExcel: null,
        excelFormatType: 'TEXT',
        displayedText: 'Không có nhiệm vụ GPMB',
        unitLabel: '',
        state: 'OUT_OF_SCOPE',
        qualityStatus: 'INSUFFICIENT_COMPONENTS',
        hasWarning: false,
        warningCount: 0,
        trace,
      };
    }

    // GPMB_BUDGET (Row 12), GPMB_PAID, GPMB_AREA_PLAN (Row 13), GPMB_AREA_DONE
    if (indicator.aggregationPolicy === 'SUM_PROJECTS' && indicator.numeratorField) {
      let sumRaw = new Decimal(0);
      const includedIds: string[] = [];
      const excludedIds: string[] = [];
      const exclusions: CalculationTrace['exclusions'] = [];
      const coverageDetails: CoverageDetail[] = [];
      const sourceRefs: SourceCellRef[] = [];

      for (const pRec of projRecords) {
        const cell = pRec.metrics[indicator.numeratorField];
        if (cell && (cell.state === 'VALUE' || cell.state === 'ZERO') && cell.normalizedDecimal) {
          sumRaw = sumRaw.plus(new Decimal(cell.normalizedDecimal));
          includedIds.push(pRec.id);
          sourceRefs.push(makeSourceCellRef(gpmb, cell));
        } else {
          excludedIds.push(pRec.id);
          const cellAddr = cell?.provenance.cell ?? `R${pRec.sourceRow}`;
          exclusions.push({
            recordId: pRec.id,
            affectedOperand: indicator.numeratorField,
            reasonCode: 'MISSING_INPUT',
            explanation: `Dự án STT ${pRec.projectStt} (dòng ${pRec.sourceRow}) thiếu giá trị tại ô ${cellAddr}.`,
            sourceCell: cellAddr,
          });
          coverageDetails.push({
            localityId: locality.id,
            localityName: locality.canonicalNameNFC,
            sourceDatasetId: gpmb.id,
            sourceType: 'GPMB',
            fieldId: indicator.numeratorField,
            status: 'FIELD_MISSING',
            reason: `Ô ${cellAddr} trống (MISSING) tại dự án STT ${pRec.projectStt} (dòng ${pRec.sourceRow}).`,
            sourceSheet: gpmb.sourceSheet,
            sourceCell: cellAddr,
            asOfDate: gpmb.asOfDate,
          });
        }
      }

      const isMoney = indicator.originalUnit === 'vnd';
      const converted = isMoney
        ? moneyUnit === 'billion'
          ? vndToBillion(sumRaw)
          : vndToMillion(sumRaw)
        : areaUnit === 'ha'
        ? m2ToHa(sumRaw)
        : sumRaw;

      const unitLabel = isMoney
        ? moneyUnit === 'billion'
          ? 'tỷ đồng'
          : 'triệu đồng'
        : areaUnit === 'ha'
        ? 'ha'
        : 'm²';
      const decimalsToUse = isMoney ? decMoney : decArea;
      const displayedText = formatVnNumber(converted, decimalsToUse);
      const qualityStatus: CalculationQuality =
        excludedIds.length > 0 ? 'PARTIAL_AGGREGATE' : 'COMPLETE';
      const traceId = `TRACE_${indicator.id}_${locality.id}_${gpmb.id}`;

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: converted.toString(),
          displayedText,
          canonicalUnit: isMoney
            ? moneyUnit === 'billion'
              ? 'billion_vnd'
              : 'million_vnd'
            : areaUnit,
          displayUnit: unitLabel,
          state: 'VALUE',
        },
        formula: {
          formulaId: `${indicator.id}_SUM_PROJECTS`,
          formulaVersion: '2.2',
          readableExpression: isMoney
            ? `SUM(dự án thuộc ${locality.canonicalNameNFC}) / ${
                moneyUnit === 'billion' ? '1.000.000.000' : '1.000.000'
              }`
            : `SUM(dự án thuộc ${locality.canonicalNameNFC})${
                areaUnit === 'ha' ? ' / 10.000' : ''
              }`,
          expressionTree: { op: 'SUM', field: indicator.numeratorField, projects: includedIds.length },
          method: 'SUM(field)',
          roundingPolicy: `ROUND_HALF_UP_${decimalsToUse}`,
          tolerancePolicy: 'EXACT_DECIMAL',
        },
        scope: {
          type: 'SINGLE_LOCALITY_PROJECTS',
          sourceDatasetIds: [gpmb.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [gpmb.asOfDate],
        },
        operands: [
          {
            role: 'sum_raw',
            fieldId: indicator.numeratorField,
            exactValue: sumRaw.toString(),
            unit: indicator.originalUnit,
            state: 'VALUE',
            sources: sourceRefs,
          },
        ],
        population: {
          eligibleCount: projRecords.length,
          includedCount: includedIds.length,
          excludedCount: excludedIds.length,
          missingCount: excludedIds.length,
          includedRecordIds: includedIds,
          excludedRecordIds: excludedIds,
        },
        coverageDetails,
        exclusions,
        steps: [
          {
            operation: 'SUM_PROJECTS',
            inputs: sourceRefs.map((s) => s.address),
            output: sumRaw.toString(),
            inputUnit: indicator.originalUnit,
            outputUnit: indicator.originalUnit,
            reason: `Cộng ${includedIds.length}/${projRecords.length} dòng dự án của ${locality.canonicalNameNFC}`,
          },
          {
            operation: 'UNIT_CONVERSION',
            inputs: [sumRaw.toString()],
            output: converted.toString(),
            inputUnit: indicator.originalUnit,
            outputUnit: unitLabel,
            reason: `Quy đổi sang ${unitLabel}`,
          },
          {
            operation: 'ROUND',
            inputs: [converted.toString()],
            output: displayedText,
            inputUnit: unitLabel,
            outputUnit: unitLabel,
            reason: `Làm tròn ROUND_HALF_UP ${decimalsToUse} chữ số thập phân`,
          },
        ],
        quality: {
          status: qualityStatus,
          warningIds: [],
        },
        sourceRefs,
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [gpmb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: converted.toString(),
        numericValueForExcel: converted.toNumber(),
        excelFormatType: isMoney ? 'MONEY' : 'AREA',
        displayedText,
        unitLabel,
        state: 'VALUE',
        qualityStatus,
        hasWarning: excludedIds.length > 0,
        warningCount: excludedIds.length,
        trace,
      };
    }

    // GPMB_AREA_RATE (Row 15) and GPMB_BUDGET_RATE
    if (
      indicator.id === 'GPMB_AREA_RATE' ||
      indicator.id === 'GPMB_BUDGET_RATE'
    ) {
      let sumNum = new Decimal(0);
      let sumDen = new Decimal(0);
      let missingAreaD = new Decimal(0);
      const includedIds: string[] = [];
      const excludedIds: string[] = [];
      const exclusions: CalculationTrace['exclusions'] = [];
      const coverageDetails: CoverageDetail[] = [];
      const sourceRefs: SourceCellRef[] = [];

      const localityMismatches = gpmb.issues.filter(
        (iss) =>
          iss.localityId === locality.id &&
          iss.ruleId === 'WARNING_M_RATIO_MISMATCH'
      );

      for (const pRec of projRecords) {
        const numCell = pRec.metrics[indicator.numeratorField!];
        const denCell = pRec.metrics[indicator.denominatorField!];
        const dValid = denCell && (denCell.state === 'VALUE' || denCell.state === 'ZERO') && denCell.normalizedDecimal;
        const iValid = numCell && (numCell.state === 'VALUE' || numCell.state === 'ZERO') && numCell.normalizedDecimal;

        if (dValid) {
          const dVal = new Decimal(denCell.normalizedDecimal!);
          sumDen = sumDen.plus(dVal);
          sourceRefs.push(makeSourceCellRef(gpmb, denCell));

          if (iValid) {
            const iVal = new Decimal(numCell.normalizedDecimal!);
            sumNum = sumNum.plus(iVal);
            includedIds.push(pRec.id);
            sourceRefs.push(makeSourceCellRef(gpmb, numCell));
          } else {
            missingAreaD = missingAreaD.plus(dVal);
            includedIds.push(pRec.id);
            const cellAddr = numCell?.provenance.cell ?? `I${pRec.sourceRow}`;
            exclusions.push({
              recordId: pRec.id,
              affectedOperand: 'numerator',
              reasonCode: 'MISSING_INPUT',
              explanation: `Dự án STT ${pRec.projectStt} (dòng ${pRec.sourceRow}) có D${pRec.sourceRow}=${dVal.toString()} m² nhưng thiếu ${cellAddr} (MISSING). Giữ D trong mẫu số và gắn cờ PARTIAL_AGGREGATE.`,
              sourceCell: cellAddr,
              sourceValue: null,
            });
            coverageDetails.push({
              localityId: locality.id,
              localityName: locality.canonicalNameNFC,
              sourceDatasetId: gpmb.id,
              sourceType: 'GPMB',
              fieldId: indicator.numeratorField,
              status: 'FIELD_MISSING',
              reason: `Dự án STT ${pRec.projectStt} (dòng ${pRec.sourceRow}) thiếu ô ${cellAddr}, diện tích phải GPMB D${pRec.sourceRow}=${dVal.toString()} m².`,
              sourceSheet: gpmb.sourceSheet,
              sourceCell: cellAddr,
              asOfDate: gpmb.asOfDate,
              impactOnComputation: 'Tỷ lệ GPMB của địa bàn mang trạng thái PARTIAL_AGGREGATE.',
            });
          }
        } else {
          excludedIds.push(pRec.id);
        }
      }

      const ratio = sumDen.gt(0) ? sumNum.div(sumDen) : null;
      const pct = ratio ? ratio.mul(100) : null;
      const qualityStatus: CalculationQuality = missingAreaD.gt(0)
        ? 'PARTIAL_AGGREGATE'
        : sumDen.isZero()
        ? 'DENOMINATOR_ZERO'
        : 'COMPLETE';
      const displayedText = pct
        ? formatVnPercent(pct, decPct)
        : sumDen.isZero()
        ? 'Không có nhiệm vụ GPMB'
        : 'Không có cơ sở tính tỷ lệ';

      const groupSummaryProvenance = gpmb.localityGroupSummaries?.[locality.id];
      const provenanceNote = groupSummaryProvenance
        ? ` (Lưu ý provenance nguồn: dòng tổng địa bàn M${groupSummaryProvenance.row} trong Excel gốc ghi ${groupSummaryProvenance.rawM}% theo công thức ${groupSummaryProvenance.formulaM || 'cũ'}, KHÔNG dùng để tính hay hiển thị báo cáo theo R06)`
        : '';

      const traceId = `TRACE_${indicator.id}_${locality.id}_${gpmb.id}`;
      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: pct ? pct.toString() : null,
          displayedText,
          canonicalUnit: 'percent',
          displayUnit: '%',
          state: pct ? 'VALUE' : 'NOT_APPLICABLE',
        },
        formula: {
          formulaId: `${indicator.id}_AREA_WEIGHTED_ONLY`,
          formulaVersion: '2.2',
          readableExpression: `SUM(I dự án đã ghi nhận) / SUM(D dự án) * 100 = ${sumNum.toString()} / ${sumDen.toString()} * 100${provenanceNote}`,
          expressionTree: {
            op: 'MUL',
            lhs: { op: 'DIV', num: 'SUM(I_recorded)', den: 'SUM(D)' },
            rhs: 100,
          },
          method: 'GPMB_RECORDED_AREA_RATIO',
          roundingPolicy: `ROUND_HALF_UP_${decPct}`,
          tolerancePolicy: 'EXACT_DECIMAL',
        },
        scope: {
          type: 'SINGLE_LOCALITY_PROJECTS',
          sourceDatasetIds: [gpmb.id],
          selectedLocalityIds: [locality.id],
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [gpmb.asOfDate],
        },
        operands: [
          {
            role: 'recorded_done_sum',
            fieldId: indicator.numeratorField!,
            exactValue: sumNum.toString(),
            unit: indicator.originalUnit === 'vnd' ? 'vnd' : 'm2',
            state: 'VALUE',
            sources: sourceRefs,
          },
          {
            role: 'declared_plan_sum',
            fieldId: indicator.denominatorField!,
            exactValue: sumDen.toString(),
            unit: indicator.originalUnit === 'vnd' ? 'vnd' : 'm2',
            state: 'VALUE',
            sources: sourceRefs,
          },
        ],
        population: {
          eligibleCount: projRecords.length,
          includedCount: includedIds.length,
          excludedCount: excludedIds.length,
          missingCount: exclusions.length,
          includedRecordIds: includedIds,
          excludedRecordIds: excludedIds,
        },
        coverageDetails,
        exclusions,
        steps: [
          {
            operation: 'SUM_RECORDED_NUMERATOR',
            inputs: [`${projRecords.length - exclusions.length}/${projRecords.length} dự án có I`],
            output: sumNum.toString(),
            inputUnit: 'm2',
            outputUnit: 'm2',
            reason: 'Cộng diện tích đã GPMB đã ghi nhận của các dự án thuộc địa bàn',
          },
          {
            operation: 'SUM_DECLARED_DENOMINATOR',
            inputs: [`${projRecords.length} dự án có D`],
            output: sumDen.toString(),
            inputUnit: 'm2',
            outputUnit: 'm2',
            reason: 'Cộng diện tích phải GPMB của tất cả dự án thuộc địa bàn',
          },
          {
            operation: 'GPMB_RECORDED_AREA_RATIO',
            inputs: [sumNum.toString(), sumDen.toString()],
            output: pct ? pct.toString() : null,
            inputUnit: 'm2',
            outputUnit: 'percent',
            reason: 'Tính tỷ lệ theo diện tích SUM(I)/SUM(D) × 100 (phương pháp duy nhất theo R06)',
          },
        ],
        quality: {
          status: qualityStatus,
          warningIds: localityMismatches.map((m) => m.id),
          missingDeclaredAmount: missingAreaD.gt(0)
            ? missingAreaD.toString()
            : undefined,
        },
        sourceRefs,
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [gpmb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: pct ? pct.toString() : null,
        numericValueForExcel: ratio ? ratio.toNumber() : null,
        excelFormatType: 'PERCENT_RATIO',
        displayedText,
        unitLabel: '%',
        state: pct ? 'VALUE' : 'NOT_APPLICABLE',
        qualityStatus,
        hasWarning:
          qualityStatus === 'PARTIAL_AGGREGATE' || localityMismatches.length > 0,
        warningCount:
          (qualityStatus === 'PARTIAL_AGGREGATE' ? 1 : 0) +
          localityMismatches.length,
        trace,
      };
    }

    // GPMB_COMPARISON_LABEL (Row 16)
    if (indicator.id === 'GPMB_COMPARISON_LABEL') {
      const locAreaRate = evaluateLocalityIndicator({
        indicator: DEFAULT_INDICATORS['GPMB_AREA_RATE'],
        locality,
        datasets,
        baselineLocalities,
        session,
        precomputedBenchmarks,
      });
      const bm =
        precomputedBenchmarks?.gpmbRateBenchmark ??
        computeBenchmarkRatio({
          indicatorId: 'GPMB_BENCHMARK_AREA_RATE',
          dataset: gpmb,
          baselineLocalities,
          numeratorField: 'gpmb_recorded_area',
          denominatorField: 'gpmb_declared_area',
          scopeType: 'LOCALITIES_AVAILABLE_N',
          decimals: decPct,
        });

      if (
        locAreaRate.state === 'MISSING' ||
        locAreaRate.state === 'OUT_OF_SCOPE' ||
        locAreaRate.exactDecimal === null ||
        locAreaRate.exactDecimal === undefined
      ) {
        const isNoTask =
          !hasLocalityInGpmb ||
          locAreaRate.displayedText === 'Không có nhiệm vụ GPMB';
        const displayedText = isNoTask ? 'Không có nhiệm vụ GPMB' : 'Chưa có số liệu';
        return {
          traceId: `TRACE_GPMB_COMPARISON_${locality.id}_${gpmb.id}`,
          indicatorId: indicator.id,
          localityId: locality.id,
          localityName: locality.canonicalNameNFC,
          exactDecimal: null,
          numericValueForExcel: null,
          excelFormatType: 'TEXT',
          displayedText,
          unitLabel: '',
          state: isNoTask ? 'OUT_OF_SCOPE' : 'MISSING',
          qualityStatus: 'INSUFFICIENT_COMPONENTS',
          hasWarning: false,
          warningCount: 0,
          trace: locAreaRate.trace,
        };
      }

      const locPct = new Decimal(locAreaRate.exactDecimal || '0');
      const bmPct = bm.exactPercent!;
      const diffPp = locPct.minus(bmPct);
      const diffFormatted = formatVnNumber(diffPp.abs(), decPct);

      const label = diffPp.gt(session.comparisonRules.higherThresholdPp)
        ? `${session.comparisonRules.higherLabel} (>${diffFormatted}%)`
        : diffPp.lt(-session.comparisonRules.lowerThresholdPp)
        ? `${session.comparisonRules.lowerLabel} (<${diffFormatted}%)`
        : `${session.comparisonRules.equalLabel} (0,00%)`;

      const traceId = `TRACE_GPMB_COMPARISON_${locality.id}_${gpmb.id}`;
      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: diffPp.toString(),
          displayedText: label,
          canonicalUnit: 'percentage_points',
          displayUnit: 'text',
          state: 'VALUE',
        },
        formula: {
          formulaId: 'GPMB_AREA_RATE_VS_BENCHMARK_108',
          formulaVersion: '2.2',
          readableExpression: `So sánh tỷ lệ diện tích GPMB địa phương (${formatVnPercent(
            locPct,
            2
          )}) với mốc danh mục 108/114 địa bàn (${formatVnPercent(
            bmPct,
            2
          )}, PARTIAL_AGGREGATE) => "${label}"`,
          expressionTree: {
            op: 'COMPARE',
            lhs: 'GPMB_AREA_RATE_i',
            rhs: 'GPMB_BENCHMARK_AREA_RATE_108',
          },
          method: 'PERCENT_POINT_DIFF',
          roundingPolicy: 'EXACT_DECIMAL_BEFORE_COMPARE',
          tolerancePolicy: '0',
        },
        scope: {
          type: 'LOCALITY_VS_AVAILABLE_108',
          sourceDatasetIds: [gpmb.id],
          selectedLocalityIds: [locality.id],
          expectedCount: 114,
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [gpmb.asOfDate],
        },
        operands: [
          {
            role: 'locality_area_rate_pct',
            fieldId: 'GPMB_AREA_RATE',
            exactValue: locPct.toString(),
            unit: 'percent',
            state: locAreaRate.state,
            sources: locAreaRate.trace.sourceRefs,
          },
          {
            role: 'benchmark_108_rate_pct',
            fieldId: 'GPMB_BENCHMARK_AREA_RATE',
            exactValue: bmPct.toString(),
            unit: 'percent',
            state: 'VALUE',
            sources: bm.trace.sourceRefs.slice(0, 10),
          },
        ],
        population: {
          eligibleCount: locAreaRate.trace.population.eligibleCount,
          includedCount: locAreaRate.trace.population.includedCount,
          excludedCount: locAreaRate.trace.population.excludedCount,
          missingCount: locAreaRate.trace.population.missingCount,
          includedRecordIds: locAreaRate.trace.population.includedRecordIds,
          excludedRecordIds: locAreaRate.trace.population.excludedRecordIds,
        },
        coverageDetails: locAreaRate.trace.coverageDetails,
        exclusions: locAreaRate.trace.exclusions,
        steps: [
          {
            operation: 'PERCENT_POINT_DIFF',
            inputs: [locPct.toString(), bmPct.toString()],
            output: diffPp.toString(),
            inputUnit: 'percent',
            outputUnit: 'percentage_points',
            reason:
              'Tính chênh lệch điểm phần trăm giữa tỷ lệ diện tích GPMB địa phương và mốc 108 địa bàn (72,13%)',
          },
          {
            operation: 'THRESHOLD_COMPARE',
            inputs: [
              diffPp.toString(),
              session.comparisonRules.higherThresholdPp.toString(),
              session.comparisonRules.lowerThresholdPp.toString(),
            ],
            output: label,
            reason: `So sánh trực tiếp chênh lệch ${diffFormatted}% với mốc trung bình: kết quả "${label}"`,
          },
        ],
        quality: {
          status: 'PARTIAL_AGGREGATE',
          warningIds: locAreaRate.trace.quality.warningIds,
          approvedByUser: session.comparisonRules.allowPartialBenchmarkEvaluation,
          approvalReason: session.comparisonRules.partialApprovalReason,
        },
        sourceRefs: locAreaRate.trace.sourceRefs,
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [gpmb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: diffPp.toString(),
        numericValueForExcel: null,
        excelFormatType: 'TEXT',
        displayedText: label,
        unitLabel: '',
        state: 'VALUE',
        qualityStatus: 'PARTIAL_AGGREGATE',
        hasWarning: true,
        warningCount: 1,
        trace,
      };
    }

    // GPMB_UNCOMPLETED_PROJECTS_COUNT (Row 17)
    if (indicator.id === 'GPMB_UNCOMPLETED_PROJECTS_COUNT') {
      const uncompletedRes = getUncompletedProjectsForSession({
        session,
        gpmbDataset: gpmb,
        baselineLocalities,
      });

      const manualOverride = session.overrides?.find(
        (o) =>
          o.indicatorId === indicator.id && o.localityId === locality.id
      );

      const displayedText =
        manualOverride?.overrideValue ||
        uncompletedRes.summaryTextByLocalityId[locality.id] ||
        'Đã hoàn thành';
      const locProjects =
        uncompletedRes.projectsByLocalityId[locality.id] || [];
      const count = locProjects.length;

      const traceId = `TRACE_GPMB_UNCOMPLETED_${locality.id}_${gpmb.id}`;
      const isNoTask = displayedText === 'Không có nhiệm vụ GPMB';

      const trace: CalculationTrace = {
        traceId,
        indicatorId: indicator.id,
        indicatorLabel: indicator.label,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        resultKind: 'CALCULATED',
        result: {
          exactDecimal: count.toString(),
          displayedText,
          canonicalUnit: 'count',
          displayUnit: 'text',
          state: isNoTask ? 'NOT_APPLICABLE' : 'VALUE',
        },
        formula: {
          formulaId: 'COUNT_UNCOMPLETED_GPMB_PROJECTS',
          formulaVersion: '2.2',
          readableExpression: `Đếm số dự án GPMB có tỷ lệ hoàn thành < 100% thuộc địa bàn ${locality.canonicalNameNFC}`,
          expressionTree: { op: 'COUNT_WHERE', condition: 'rate < 100%' },
          method: 'PROJECT_STATUS_FILTER',
          roundingPolicy: 'INTEGER',
          tolerancePolicy: '0',
        },
        scope: {
          type: 'LOCALITY_PROJECTS',
          sourceDatasetIds: [gpmb.id],
          selectedLocalityIds: [locality.id],
          expectedCount: 1,
          matchingPolicyId: 'STRICT_NFC_DIACRITICS_V2_2',
          asOfDates: [gpmb.asOfDate],
        },
        operands: [
          {
            role: 'uncompleted_project_count',
            fieldId: 'uncompleted_projects',
            exactValue: count.toString(),
            unit: 'project_count',
            state: isNoTask ? 'NOT_APPLICABLE' : 'VALUE',
            sources: [],
          },
        ],
        population: {
          eligibleCount: projRecords.length,
          includedCount: count,
          excludedCount: projRecords.length - count,
          missingCount: 0,
          includedRecordIds: locProjects.map((p) => p.id),
          excludedRecordIds: [],
        },
        coverageDetails: [],
        exclusions: [],
        steps: [
          {
            operation: 'COUNT_UNCOMPLETED',
            inputs: [`${projRecords.length} dự án thuộc địa bàn`],
            output: displayedText,
            reason: `Xác định các dự án có tỷ lệ GPMB < 100% của ${locality.canonicalNameNFC}`,
          },
        ],
        quality: {
          status: 'COMPLETE',
          warningIds: [],
        },
        sourceRefs: [],
        createdAt: new Date().toISOString(),
        engineVersion: '2.2.0',
        datasetHashes: [gpmb.workbookSha256],
      };

      return {
        traceId,
        indicatorId: indicator.id,
        localityId: locality.id,
        localityName: locality.canonicalNameNFC,
        exactDecimal: count.toString(),
        numericValueForExcel: count,
        excelFormatType: 'TEXT',
        displayedText,
        unitLabel: '',
        state: isNoTask ? 'NOT_APPLICABLE' : 'VALUE',
        qualityStatus: 'COMPLETE',
        hasWarning: false,
        warningCount: 0,
        trace,
      };
    }
  }

  throw new Error(`Unsupported indicator evaluation: ${indicator.id}`);
}

export interface EvaluatedReportRow {
  rowConfig: ReportSession['templateRows'][number];
  indicator: IndicatorDefinition;
  cellsByLocalityId: Record<string, EvaluatedReportCell>;
  selectedGroupCell?: EvaluatedReportCell;
}

export interface EvaluatedSessionReport {
  session: ReportSession;
  selectedLocalities: Locality[];
  rows: EvaluatedReportRow[];
  tracesById: Map<string, CalculationTrace>;
  benchmarks: {
    disbPlanAvg?: ReturnType<typeof computeDisbPlanPerUnitBenchmark>;
    disbRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    revRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    revLandRateYBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    revLandRatePBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    gpmbRateBenchmark?: ReturnType<typeof computeBenchmarkRatio>;
    selectedGroupGpmbRate?: ReturnType<typeof computeBenchmarkRatio>;
  };
  sessionIssues: QualityIssue[];
}

export function evaluateSessionReport(params: {
  session: ReportSession;
  baselineLocalities: Locality[];
  datasets: { REV?: Dataset; DISB?: Dataset; GPMB?: Dataset };
}): EvaluatedSessionReport {
  const { session, baselineLocalities, datasets } = params;
  const tracesById = new Map<string, CalculationTrace>();

  const decMoney = session.settings.decimalsMoney ?? session.settings.decimals ?? 2;
  const decPct = session.settings.decimalsPercent ?? session.settings.decimals ?? 2;

  const disbPlanAvg = datasets.DISB
    ? computeDisbPlanPerUnitBenchmark(
        datasets.DISB,
        session.settings.moneyUnit,
        decMoney
      )
    : undefined;
  if (disbPlanAvg) tracesById.set(disbPlanAvg.trace.traceId, disbPlanAvg.trace);

  const disbRateBenchmark = datasets.DISB
    ? computeBenchmarkRatio({
        indicatorId: 'DISB_BENCHMARK_RATE',
        dataset: datasets.DISB,
        baselineLocalities,
        numeratorField: 'disbursed_total',
        denominatorField: 'adjusted_total_plan',
        scopeType: 'LOCALITIES_FULL_114',
        decimals: decPct,
      })
    : undefined;
  if (disbRateBenchmark)
    tracesById.set(disbRateBenchmark.trace.traceId, disbRateBenchmark.trace);

  const revRateBenchmark = datasets.REV
    ? computeBenchmarkRatio({
        indicatorId: 'REV_RATE_Y',
        dataset: datasets.REV,
        baselineLocalities,
        numeratorField: 'actual_total_revenue',
        denominatorField: 'annual_total_budget',
        scopeType:
          baselineLocalities.length > 0 &&
          datasets.REV.unitCount >= baselineLocalities.length
            ? 'LOCALITIES_FULL_114'
            : 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      })
    : undefined;
  if (revRateBenchmark)
    tracesById.set(revRateBenchmark.trace.traceId, revRateBenchmark.trace);

  const revLandRateYBenchmark = datasets.REV
    ? computeBenchmarkRatio({
        indicatorId: 'REV_LAND_RATE_Y',
        dataset: datasets.REV,
        baselineLocalities,
        numeratorField: 'actual_land_revenue',
        denominatorField: 'annual_land_budget',
        scopeType: 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      })
    : undefined;
  if (revLandRateYBenchmark)
    tracesById.set(
      revLandRateYBenchmark.trace.traceId,
      revLandRateYBenchmark.trace
    );

  const revLandRatePBenchmark = datasets.REV
    ? computeBenchmarkRatio({
        indicatorId: 'REV_LAND_RATE_P',
        dataset: datasets.REV,
        baselineLocalities,
        numeratorField: 'actual_land_revenue',
        denominatorField: 'period_land_plan',
        scopeType: 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      })
    : undefined;
  if (revLandRatePBenchmark)
    tracesById.set(
      revLandRatePBenchmark.trace.traceId,
      revLandRatePBenchmark.trace
    );

  const gpmbRateBenchmark = datasets.GPMB
    ? computeBenchmarkRatio({
        indicatorId: 'GPMB_BENCHMARK_AREA_RATE',
        dataset: datasets.GPMB,
        baselineLocalities,
        numeratorField: 'gpmb_recorded_area',
        denominatorField: 'gpmb_declared_area',
        scopeType: 'LOCALITIES_AVAILABLE_N',
        decimals: decPct,
      })
    : undefined;
  if (gpmbRateBenchmark)
    tracesById.set(gpmbRateBenchmark.trace.traceId, gpmbRateBenchmark.trace);

  const selectedGroupGpmbRate =
    datasets.GPMB && session.selectedLocalityIds.length > 0
      ? computeBenchmarkRatio({
          indicatorId: 'GPMB_AREA_RATE_SELECTED_GROUP',
          dataset: datasets.GPMB,
          baselineLocalities,
          numeratorField: 'gpmb_recorded_area',
          denominatorField: 'gpmb_declared_area',
          scopeType: 'SELECTED_UNITS',
          selectedLocalityIds: session.selectedLocalityIds,
          decimals: decPct,
        })
      : undefined;
  if (selectedGroupGpmbRate)
    tracesById.set(
      selectedGroupGpmbRate.trace.traceId,
      selectedGroupGpmbRate.trace
    );

  const selectedLocalities: Locality[] = session.selectedLocalityIds
    .map((id) => baselineLocalities.find((l) => l.id === id))
    .filter((l): l is Locality => Boolean(l));

  const sortedTemplateRows = [...session.templateRows]
    .filter((r) => {
      if (!r.visible) return false;
      if (
        !session.settings.showBenchmarkRows &&
        (r.indicatorId === 'DISB_BENCHMARK_RATE' ||
          r.indicatorId === 'GPMB_BENCHMARK_AREA_RATE')
      ) {
        return false;
      }
      if (
        !session.settings.showCommentRows &&
        (r.indicatorId === 'DISB_PLAN_VS_AVG_COMMENT' ||
          r.indicatorId === 'DISB_COMPARISON_LABEL' ||
          r.indicatorId === 'GPMB_COMPARISON_LABEL')
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  let evalRowConfigs: TemplateRowCustomConfig[] = sortedTemplateRows.map((r) => {
    let customLabel = normalizeLocalityReportLabel(r.indicatorId, r.customLabel);
    if (r.indicatorId === 'DISB_BENCHMARK_RATE' || r.indicatorId === 'GPMB_BENCHMARK_AREA_RATE') {
      const ds = r.indicatorId === 'DISB_BENCHMARK_RATE' ? datasets.DISB : datasets.GPMB;
      customLabel = formatBenchmarkReportLabel({
        indicatorId: r.indicatorId, customLabel,
        unitCount: ds?.unitCount, expectedCount: baselineLocalities.length || 114,
        asOfDate: ds?.asOfDate,
      });
    }
    return { ...r, customLabel };
  });
  if (
    session.settings.showRevBenchmarkRow &&
    datasets.REV &&
    session.settings.showBenchmarkRows !== false
  ) {
    // When displaying the common revenue rate row, it takes STT "2" while REV_RATE_Y
    // becomes a sub-row (empty STT) and drops the repeated "(đến ngày ...)" suffix.
    evalRowConfigs = evalRowConfigs.map((r) =>
      r.indicatorId === 'REV_RATE_Y'
        ? {
            ...r,
            sttLabel: '',
            customLabel: r.customLabel
              .replace(/\s*\(đến ngày[^)]*\)/gi, '')
              .replace(/\s{2,}/g, ' ')
              .trim(),
          }
        : r
    );
    const revBmConfig: TemplateRowCustomConfig = {
      rowNumber: 30,
      indicatorId: 'REV_BENCHMARK_RATE',
      sttLabel: '2',
      customLabel: formatRevBenchmarkRowLabel({
        customLabel: session.settings.revBenchmarkRowCustomLabel,
        unitCount: datasets.REV.unitCount,
        expectedCount: baselineLocalities.length || 114,
        asOfDate: datasets.REV.asOfDate,
      }),
      groupName: 'I. Thu ngân sách nhà nước',
      visible: true,
      order: 1.5,
    };
    const revRateIdx = evalRowConfigs.findIndex((r) => r.indicatorId === 'REV_RATE_Y');
    if (revRateIdx >= 0) {
      evalRowConfigs.splice(revRateIdx, 0, revBmConfig);
    } else {
      evalRowConfigs.unshift(revBmConfig);
    }
  }

  if (session.settings.showRevRealizedRow) {
    evalRowConfigs=evalRowConfigs.filter(r=>r.indicatorId!=='REV_REALIZED').map(r=>({...r,sttLabel:reportMainStt(session,r.sttLabel)}));
    const realized:TemplateRowCustomConfig={
      rowNumber:31,indicatorId:'REV_REALIZED',sttLabel:'2',
      customLabel:formatRevRealizedRowLabel({customLabel:session.settings.revRealizedRowCustomLabel,asOfDate:datasets.REV?.asOfDate}),
      groupName:'I. Thu ngân sách nhà nước',visible:true,order:1.25,
    };
    const budgetIndex=evalRowConfigs.findIndex(r=>r.indicatorId==='REV_BUDGET_Y');
    const rateIndex=evalRowConfigs.findIndex(r=>r.indicatorId==='REV_BENCHMARK_RATE'||r.indicatorId==='REV_RATE_Y');
    evalRowConfigs.splice(budgetIndex>=0?budgetIndex+1:Math.max(0,rateIndex),0,realized);
  }

  const rows: EvaluatedReportRow[] = [];

  for (const rowCfg of evalRowConfigs) {
    const ind = DEFAULT_INDICATORS[rowCfg.indicatorId];
    if (!ind || ind.isQualityCheckOnly) continue;

    const cellsByLocalityId: Record<string, EvaluatedReportCell> = {};
    for (const loc of selectedLocalities) {
      const evaluated = evaluateLocalityIndicator({
        indicator: ind,
        locality: loc,
        datasets,
        baselineLocalities,
        session,
        precomputedBenchmarks: {
          disbPlanAvg,
          disbRateBenchmark,
          revRateBenchmark,
          gpmbRateBenchmark,
        },
      });
      cellsByLocalityId[loc.id] = evaluated;
      tracesById.set(evaluated.trace.traceId, evaluated.trace);
    }

    rows.push({
      rowConfig: rowCfg,
      indicator: ind,
      cellsByLocalityId,
    });
  }

  const selectedSet = new Set(session.selectedLocalityIds);
  const sessionIssues: QualityIssue[] = [];
  for (const ds of [datasets.DISB, datasets.REV, datasets.GPMB]) {
    if (!ds || !Array.isArray(ds.issues)) continue;
    for (const iss of ds.issues) {
      if (iss.localityId === 'ALL' || selectedSet.has(iss.localityId)) {
        sessionIssues.push(iss);
      }
    }
  }

  return {
    session,
    selectedLocalities,
    rows,
    tracesById,
    benchmarks: {
      disbPlanAvg,
      disbRateBenchmark,
      revRateBenchmark,
      revLandRateYBenchmark,
      revLandRatePBenchmark,
      gpmbRateBenchmark,
      selectedGroupGpmbRate,
    },
    sessionIssues,
  };
}
