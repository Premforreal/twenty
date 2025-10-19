import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { type ExtendedAggregateOperations } from '@/object-record/record-table/types/ExtendedAggregateOperations';
import { getAggregateOperationLabel } from '@/object-record/record-board/record-board-column/utils/getAggregateOperationLabel';
import { getGroupByQueryName } from '@/page-layout/utils/getGroupByQueryName';
import { type LineChartSeries } from '@/page-layout/widgets/graph/graphWidgetLineChart/types/LineChartSeries';
import { type GroupByRawResult } from '@/page-layout/widgets/graph/types/GroupByRawResult';
import { filterGroupByResults } from '@/page-layout/widgets/graph/utils/filterGroupByResults';
import { transformOneDimensionalGroupByToLineChartData } from '@/page-layout/widgets/graph/utils/transformOneDimensionalGroupByToLineChartData';
import { transformTwoDimensionalGroupByToLineChartData } from '@/page-layout/widgets/graph/utils/transformTwoDimensionalGroupByToLineChartData';
import { isDefined } from 'twenty-shared/utils';
import {
  AxisNameDisplay,
  type LineChartConfiguration,
} from '~/generated/graphql';

type TransformGroupByDataToLineChartDataParams = {
  groupByData: Record<string, GroupByRawResult[]> | null | undefined;
  objectMetadataItem: ObjectMetadataItem;
  configuration: LineChartConfiguration;
  aggregateOperation: string;
};

type TransformGroupByDataToLineChartDataResult = {
  series: LineChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  showDataLabels: boolean;
};

const EMPTY_LINE_CHART_RESULT: TransformGroupByDataToLineChartDataResult = {
  series: [],
  xAxisLabel: undefined,
  yAxisLabel: undefined,
  showDataLabels: false,
};

export const transformGroupByDataToLineChartData = ({
  groupByData,
  objectMetadataItem,
  configuration,
  aggregateOperation,
}: TransformGroupByDataToLineChartDataParams): TransformGroupByDataToLineChartDataResult => {
  if (!isDefined(groupByData)) {
    return EMPTY_LINE_CHART_RESULT;
  }

  const groupByFieldX = objectMetadataItem.fields.find(
    (field: FieldMetadataItem) =>
      field.id === configuration.primaryAxisGroupByFieldMetadataId,
  );

  const groupByFieldY = isDefined(
    configuration.secondaryAxisGroupByFieldMetadataId,
  )
    ? objectMetadataItem.fields.find(
        (field: FieldMetadataItem) =>
          field.id === configuration.secondaryAxisGroupByFieldMetadataId,
      )
    : undefined;

  const aggregateField = objectMetadataItem.fields.find(
    (field: FieldMetadataItem) =>
      field.id === configuration.aggregateFieldMetadataId,
  );

  if (!isDefined(groupByFieldX) || !isDefined(aggregateField)) {
    return EMPTY_LINE_CHART_RESULT;
  }

  const primaryAxisSubFieldName =
    configuration.primaryAxisGroupBySubFieldName ?? undefined;

  const queryName = getGroupByQueryName(objectMetadataItem);
  const rawResults = groupByData[queryName];

  if (!isDefined(rawResults) || !Array.isArray(rawResults)) {
    return EMPTY_LINE_CHART_RESULT;
  }

  const filteredResults = filterGroupByResults({
    rawResults,
    filterOptions: {
      rangeMin: configuration.rangeMin ?? undefined,
      rangeMax: configuration.rangeMax ?? undefined,
      omitNullValues: configuration.omitNullValues ?? false,
    },
    aggregateField,
    aggregateOperation:
      configuration.aggregateOperation as unknown as ExtendedAggregateOperations,
    aggregateOperationFromRawResult: aggregateOperation,
    objectMetadataItem,
  });

  const showXAxis =
    configuration.axisNameDisplay === AxisNameDisplay.X ||
    configuration.axisNameDisplay === AxisNameDisplay.BOTH;

  const showYAxis =
    configuration.axisNameDisplay === AxisNameDisplay.Y ||
    configuration.axisNameDisplay === AxisNameDisplay.BOTH;

  const xAxisLabel = showXAxis ? groupByFieldX.label : undefined;

  const yAxisLabel = showYAxis
    ? `${getAggregateOperationLabel(configuration.aggregateOperation)} of ${aggregateField.label}`
    : undefined;

  const showDataLabels = configuration.displayDataLabel ?? false;

  const baseResult = isDefined(groupByFieldY)
    ? transformTwoDimensionalGroupByToLineChartData({
        rawResults: filteredResults,
        groupByFieldX,
        groupByFieldY,
        aggregateField,
        configuration,
        aggregateOperation,
        objectMetadataItem,
        primaryAxisSubFieldName,
      })
    : transformOneDimensionalGroupByToLineChartData({
        rawResults: filteredResults,
        groupByFieldX,
        aggregateField,
        configuration,
        aggregateOperation,
        objectMetadataItem,
        primaryAxisSubFieldName,
      });

  return {
    ...baseResult,
    xAxisLabel,
    yAxisLabel,
    showDataLabels,
  };
};
