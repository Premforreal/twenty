import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { type LineChartSeries } from '@/page-layout/widgets/graph/graphWidgetLineChart/types/LineChartSeries';
import { useGraphWidgetGroupByQuery } from '@/page-layout/widgets/graph/hooks/useGraphWidgetGroupByQuery';
import { transformGroupByDataToLineChartData } from '@/page-layout/widgets/graph/utils/transformGroupByDataToLineChartData';
import { useMemo } from 'react';
import { type LineChartConfiguration } from '~/generated/graphql';

type UseGraphLineChartWidgetDataProps = {
  objectMetadataItemId: string;
  configuration: LineChartConfiguration;
};

type UseGraphLineChartWidgetDataResult = {
  series: LineChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  showDataLabels: boolean;
  loading: boolean;
  error?: Error;
};

export const useGraphLineChartWidgetData = ({
  objectMetadataItemId,
  configuration,
}: UseGraphLineChartWidgetDataProps): UseGraphLineChartWidgetDataResult => {
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataItemId,
  });

  const {
    data: groupByData,
    loading,
    error,
    aggregateOperation,
  } = useGraphWidgetGroupByQuery({
    objectMetadataItemId,
    configuration,
  });

  const transformedData = useMemo(
    () =>
      transformGroupByDataToLineChartData({
        groupByData,
        objectMetadataItem,
        configuration,
        aggregateOperation,
      }),
    [groupByData, objectMetadataItem, configuration, aggregateOperation],
  );

  return {
    ...transformedData,
    loading,
    error,
  };
};
