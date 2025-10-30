import { type ApolloCache, type StoreObject } from '@apollo/client';

import { type CachedObjectRecordQueryVariables } from '@/apollo/types/CachedObjectRecordQueryVariables';
import { encodeCursor } from '@/apollo/utils/encodeCursor';
import { type ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { type RecordGqlRefEdge } from '@/object-record/cache/types/RecordGqlRefEdge';
import { getEdgeTypename } from '@/object-record/cache/utils/getEdgeTypename';
import { type RecordGqlNode } from '@/object-record/graphql/types/RecordGqlNode';
import { type RecordGqlGroupByConnection } from '@/object-record/graphql/types/RecordGqlOperationGroupByResult';
import { type RecordGqlOperationGroupByVariables } from '@/object-record/graphql/types/RecordGqlOperationGroupByVariables';
import { isRecordMatchingFilter } from '@/object-record/record-filter/utils/isRecordMatchingFilter';
import { isDefined } from 'twenty-shared/utils';
import { parseApolloStoreFieldName } from '~/utils/parseApolloStoreFieldName';

type TriggerUpdateGroupByQueriesOptimisticEffectArgs = {
  cache: ApolloCache<unknown>;
  objectMetadataItem: ObjectMetadataItem;
  operation: 'create' | 'update' | 'delete';
  records: RecordGqlNode[];
  shouldMatchRootQueryFilter?: boolean;
};

type ProcessConnectionArgs = {
  cachedEdges: readonly RecordGqlRefEdge[];
  cachedPageInfo: {
    startCursor?: string;
    endCursor?: string;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
  records: RecordGqlNode[];
  operation: 'create' | 'update' | 'delete';
  queryFilter: any;
  shouldMatchRootQueryFilter: boolean;
  groupByDimensionValues: readonly string[];
  groupByConfig?: Array<Record<string, boolean | Record<string, string>>>;
  objectMetadataItem: ObjectMetadataItem;
  readField: (fieldName: string, ref?: any) => any;
  toReference: (record: RecordGqlNode) => any;
};

const normalizeValueForComparison = (
  value: any,
  fieldConfig: boolean | Record<string, string> | undefined,
): string => {
  if (typeof fieldConfig === 'object' && isDefined(fieldConfig.granularity)) {
    const dateValue = new Date(value);
    const granularity = fieldConfig.granularity;

    // TODO: to remove once backend properly returns DATE without time
    switch (granularity) {
      case 'DAY':
        return dateValue.toISOString().split('T')[0];
      case 'MONTH':
        return dateValue.toISOString().substring(0, 7);
      case 'YEAR':
        return dateValue.getFullYear().toString();
      case 'DAY_OF_THE_WEEK':
        return dateValue.getDay().toString();
      case 'MONTH_OF_THE_YEAR':
        return (dateValue.getMonth() + 1).toString();
      default:
        return String(value);
    }
  }

  if (typeof value === 'object' && value !== null) {
    return value.id ? String(value.id) : JSON.stringify(value);
  }

  return String(value);
};

const doesRecordBelongToGroup = (
  record: RecordGqlNode,
  groupByDimensionValues: readonly string[],
  groupByConfig?: Array<Record<string, boolean | Record<string, string>>>,
): boolean => {
  if (!isDefined(groupByConfig) || groupByConfig.length === 0) {
    return true;
  }

  const groupByFieldNames = groupByConfig.map(
    (groupByField) => Object.keys(groupByField)[0],
  );

  for (let i = 0; i < groupByFieldNames.length; i++) {
    const fieldName = groupByFieldNames[i];
    const expectedValue = groupByDimensionValues[i];

    if (!isDefined(expectedValue)) {
      continue;
    }

    let recordValue = record[fieldName];

    if (!isDefined(recordValue)) {
      return false;
    }

    const fieldConfig = groupByConfig[i][fieldName];
    const recordValueStr = normalizeValueForComparison(
      recordValue,
      fieldConfig,
    );
    const expectedValueStr = normalizeValueForComparison(
      expectedValue,
      fieldConfig,
    );

    if (recordValueStr !== expectedValueStr) {
      return false;
    }
  }

  return true;
};

const processConnectionWithRecords = ({
  cachedEdges,
  cachedPageInfo,
  records,
  operation,
  queryFilter,
  shouldMatchRootQueryFilter,
  groupByDimensionValues,
  groupByConfig,
  objectMetadataItem,
  readField,
  toReference,
}: ProcessConnectionArgs): {
  nextEdges: RecordGqlRefEdge[];
  nextPageInfo: {
    startCursor?: string;
    endCursor?: string;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
  totalCountDelta: number;
} => {
  const nextEdges = [...cachedEdges];
  const nextPageInfo = isDefined(cachedPageInfo) ? { ...cachedPageInfo } : {};
  let totalCountDelta = 0;

  for (const record of records) {
    const recordMatchesFilter = isRecordMatchingFilter({
      record,
      filter: queryFilter ?? {},
      objectMetadataItem,
    });

    const belongsToGroup = doesRecordBelongToGroup(
      record,
      groupByDimensionValues,
      groupByConfig,
    );

    const recordReference = toReference(record);

    if (!recordReference) {
      continue;
    }

    const recordIndexInEdges = cachedEdges.findIndex(
      (cachedEdge) => readField('id', cachedEdge.node) === record.id,
    );
    const recordExistsInEdges = recordIndexInEdges !== -1;

    if (operation === 'create') {
      const shouldAdd =
        (!shouldMatchRootQueryFilter || recordMatchesFilter) &&
        belongsToGroup &&
        !recordExistsInEdges;

      if (shouldAdd) {
        const cursor = encodeCursor(record);
        const edge = {
          __typename: getEdgeTypename(objectMetadataItem.nameSingular),
          node: recordReference,
          cursor,
        };

        nextEdges.unshift(edge);
        nextPageInfo.startCursor = cursor;
        totalCountDelta++;
      }
    }

    if (operation === 'update') {
      const shouldBeInGroup = recordMatchesFilter && belongsToGroup;

      if (shouldBeInGroup && !recordExistsInEdges) {
        const cursor = encodeCursor(record);
        const edge = {
          __typename: getEdgeTypename(objectMetadataItem.nameSingular),
          node: recordReference,
          cursor,
        };

        nextEdges.push(edge);
        totalCountDelta++;
      } else if (!shouldBeInGroup && recordExistsInEdges) {
        nextEdges.splice(recordIndexInEdges, 1);
        totalCountDelta--;
      }
    }

    if (operation === 'delete') {
      if (recordExistsInEdges) {
        nextEdges.splice(recordIndexInEdges, 1);
        totalCountDelta--;
      }
    }
  }

  return { nextEdges, nextPageInfo, totalCountDelta };
};

export const triggerUpdateGroupByQueriesOptimisticEffect = ({
  cache,
  objectMetadataItem,
  operation,
  records,
  shouldMatchRootQueryFilter = false,
}: TriggerUpdateGroupByQueriesOptimisticEffectArgs) => {
  const groupByQueryFieldName = `${objectMetadataItem.namePlural}GroupBy`;

  cache.modify<StoreObject>({
    broadcast: false,
    fields: {
      [groupByQueryFieldName]: (
        cachedGroupByQueryResult,
        { readField, toReference, storeFieldName },
      ) => {
        const cachedGroupByConnections = cachedGroupByQueryResult as
          | RecordGqlGroupByConnection[]
          | undefined;

        if (!Array.isArray(cachedGroupByConnections)) {
          return cachedGroupByQueryResult;
        }

        const { fieldVariables: queryVariables } = parseApolloStoreFieldName<
          CachedObjectRecordQueryVariables & RecordGqlOperationGroupByVariables
        >(storeFieldName);

        const queryFilter = queryVariables?.filter;
        const groupByConfig = queryVariables?.groupBy;

        // Process each group connection
        const updatedGroupByConnections = cachedGroupByConnections.map(
          (groupConnection) => {
            const groupByDimensionValues =
              readField('groupByDimensionValues', groupConnection) || [];
            const cachedEdges =
              readField<RecordGqlRefEdge[]>('edges', groupConnection) || [];
            const cachedTotalCount = readField<number | undefined>(
              'totalCount',
              groupConnection,
            );
            const cachedPageInfo = readField<{
              startCursor?: string;
              endCursor?: string;
              hasNextPage?: boolean;
              hasPreviousPage?: boolean;
            }>('pageInfo', groupConnection);

            const { nextEdges, nextPageInfo, totalCountDelta } =
              processConnectionWithRecords({
                cachedEdges,
                cachedPageInfo: cachedPageInfo || {},
                records,
                operation,
                queryFilter,
                shouldMatchRootQueryFilter,
                groupByDimensionValues: Array.isArray(groupByDimensionValues)
                  ? groupByDimensionValues
                  : [],
                groupByConfig,
                objectMetadataItem,
                readField,
                toReference,
              });

            if (
              totalCountDelta === 0 &&
              nextEdges.length === cachedEdges.length
            ) {
              return groupConnection;
            }

            return {
              ...groupConnection,
              edges: nextEdges,
              totalCount: isDefined(cachedTotalCount)
                ? cachedTotalCount + totalCountDelta
                : undefined,
              pageInfo: nextPageInfo,
            };
          },
        );

        // Handle records that belong to dimensions not yet in the cache
        if (operation === 'create' || operation === 'update') {
          const recordsToAddToNewGroups: Map<
            string,
            {
              dimensionValues: string[];
              edges: RecordGqlRefEdge[];
            }
          > = new Map();

          for (const record of records) {
            const recordMatchesFilter = isRecordMatchingFilter({
              record,
              filter: queryFilter ?? {},
              objectMetadataItem,
            });

            if (
              shouldMatchRootQueryFilter &&
              !recordMatchesFilter &&
              operation === 'create'
            ) {
              continue;
            }

            if (!isDefined(groupByConfig) || groupByConfig.length === 0) {
              continue;
            }

            const recordDimensionValues: string[] = [];
            const groupByFieldNames = groupByConfig.map(
              (groupByField) => Object.keys(groupByField)[0],
            );

            for (let i = 0; i < groupByFieldNames.length; i++) {
              const fieldName = groupByFieldNames[i];
              let recordValue = record[fieldName];

              if (!isDefined(recordValue)) {
                break;
              }

              const fieldConfig = groupByConfig[i][fieldName];
              const normalizedValue = normalizeValueForComparison(
                recordValue,
                fieldConfig,
              );
              recordDimensionValues.push(normalizedValue);
            }

            const dimensionKey = recordDimensionValues.join('|');
            const dimensionExists = updatedGroupByConnections.some((conn) => {
              const connDimensionValues =
                readField('groupByDimensionValues', conn) || [];
              return (
                Array.isArray(connDimensionValues) &&
                connDimensionValues.join('|') === dimensionKey
              );
            });

            if (
              !dimensionExists &&
              recordDimensionValues.length === groupByFieldNames.length
            ) {
              const recordReference = toReference(record);

              if (isDefined(recordReference)) {
                if (!recordsToAddToNewGroups.has(dimensionKey)) {
                  recordsToAddToNewGroups.set(dimensionKey, {
                    dimensionValues: recordDimensionValues,
                    edges: [],
                  });
                }

                const cursor = encodeCursor(record);
                const edge = {
                  __typename: getEdgeTypename(objectMetadataItem.nameSingular),
                  node: recordReference,
                  cursor,
                };

                recordsToAddToNewGroups.get(dimensionKey)!.edges.push(edge);
              }
            }
          }

          for (const [_, groupData] of recordsToAddToNewGroups) {
            if (groupData.edges.length > 0) {
              const newGroupConnection = {
                __typename: `${objectMetadataItem.nameSingular}Connection`,
                edges: groupData.edges,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: false,
                  startCursor: groupData.edges[0].cursor,
                  endCursor: groupData.edges[groupData.edges.length - 1].cursor,
                },
                totalCount: groupData.edges.length,
                groupByDimensionValues: groupData.dimensionValues,
              };

              updatedGroupByConnections.push(newGroupConnection);
            }
          }
        }

        return updatedGroupByConnections;
      },
    },
  });
};
