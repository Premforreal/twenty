import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { EMPTY_FLAT_ENTITY_MAPS } from 'src/engine/metadata-modules/flat-entity/constant/empty-flat-entity-maps.constant';
import { FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { fromFieldMetadataEntityToFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/utils/from-field-metadata-entity-to-flat-field-metadata.util';
import { ViewFieldEntity } from 'src/engine/metadata-modules/view-field/entities/view-field.entity';
import { ViewFilterEntity } from 'src/engine/metadata-modules/view-filter/entities/view-filter.entity';
import { ViewGroupEntity } from 'src/engine/metadata-modules/view-group/entities/view-group.entity';
import { ViewEntity } from 'src/engine/metadata-modules/view/entities/view.entity';
import { WorkspaceFlatMapCache } from 'src/engine/workspace-flat-map-cache/decorators/workspace-flat-map-cache.decorator';
import { WorkspaceFlatMapCacheService } from 'src/engine/workspace-flat-map-cache/services/workspace-flat-map-cache.service';
import { prastoin } from 'src/engine/workspace-flat-map-cache/utils/prastoin';

@Injectable()
@WorkspaceFlatMapCache('flatFieldMetadataMaps')
export class WorkspaceFlatFieldMetadataMapCacheService extends WorkspaceFlatMapCacheService<
  FlatEntityMaps<FlatFieldMetadata>
> {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    cacheStorageService: CacheStorageService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    @InjectRepository(ViewFieldEntity)
    private readonly viewFieldRepository: Repository<ViewFieldEntity>,
    @InjectRepository(ViewFilterEntity)
    private readonly viewFilterRepository: Repository<ViewFilterEntity>,
    @InjectRepository(ViewGroupEntity)
    private readonly viewGroupRepository: Repository<ViewGroupEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>,
  ) {
    super(cacheStorageService);
  }

  protected async computeFlatMap({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatEntityMaps<FlatFieldMetadata>> {
    const { others, parent } = await prastoin<'fieldMetadata'>({
      parent: this.fieldMetadataRepository,
      workspaceId,
      repos: {
        view: {
          foreignKeys: [
            'calendarFieldMetadataId',
            'kanbanAggregateOperationFieldMetadataId',
          ],
          repository: this.viewRepository,
        },
        viewField: {
          foreignKeys: ['fieldMetadataId'],
          repository: this.viewFieldRepository,
        },
        viewFilter: {
          foreignKeys: ['fieldMetadataId'],
          repository: this.viewFilterRepository,
        },
        viewGroup: {
          foreignKeys: ['fieldMetadataId'],
          repository: this.viewGroupRepository,
        },
      },
    });

    // Build maps of fieldMetadataId -> related IDs
    // const viewFieldsByFieldId = new Map<string, { id: string }[]>();
    // const viewFiltersByFieldId = new Map<string, { id: string }[]>();
    // const viewGroupsByFieldId = new Map<string, { id: string }[]>();
    // const kanbanViewsByFieldId = new Map<string, { id: string }[]>();
    // const calendarViewsByFieldId = new Map<string, { id: string }[]>();

    // for (const viewField of viewFields) {
    //   if (!viewFieldsByFieldId.has(viewField.fieldMetadataId)) {
    //     viewFieldsByFieldId.set(viewField.fieldMetadataId, []);
    //   }
    //   viewFieldsByFieldId
    //     .get(viewField.fieldMetadataId)!
    //     .push({ id: viewField.id });
    // }

    // for (const viewFilter of viewFilters) {
    //   if (!viewFiltersByFieldId.has(viewFilter.fieldMetadataId)) {
    //     viewFiltersByFieldId.set(viewFilter.fieldMetadataId, []);
    //   }
    //   viewFiltersByFieldId
    //     .get(viewFilter.fieldMetadataId)!
    //     .push({ id: viewFilter.id });
    // }

    // for (const viewGroup of viewGroups) {
    //   if (!viewGroupsByFieldId.has(viewGroup.fieldMetadataId)) {
    //     viewGroupsByFieldId.set(viewGroup.fieldMetadataId, []);
    //   }
    //   viewGroupsByFieldId
    //     .get(viewGroup.fieldMetadataId)!
    //     .push({ id: viewGroup.id });
    // }

    // for (const kanbanView of kanbanViews) {
    //   if (kanbanView.kanbanAggregateOperationFieldMetadataId) {
    //     if (
    //       !kanbanViewsByFieldId.has(
    //         kanbanView.kanbanAggregateOperationFieldMetadataId,
    //       )
    //     ) {
    //       kanbanViewsByFieldId.set(
    //         kanbanView.kanbanAggregateOperationFieldMetadataId,
    //         [],
    //       );
    //     }
    //     kanbanViewsByFieldId
    //       .get(kanbanView.kanbanAggregateOperationFieldMetadataId)!
    //       .push({ id: kanbanView.id });
    //   }
    // }

    // for (const calendarView of calendarViews) {
    //   if (calendarView.calendarFieldMetadataId) {
    //     if (!calendarViewsByFieldId.has(calendarView.calendarFieldMetadataId)) {
    //       calendarViewsByFieldId.set(calendarView.calendarFieldMetadataId, []);
    //     }
    //     calendarViewsByFieldId
    //       .get(calendarView.calendarFieldMetadataId)!
    //       .push({ id: calendarView.id });
    //   }
    // }

    // Build field metadata entities with relations
    return fieldMetadatas.reduce(
      (flatFieldMetadataMaps, fieldMetadataEntity) => {
        const fieldMetadataWithRelations = {
          ...fieldMetadataEntity,
          viewFields: viewFieldsByFieldId.get(fieldMetadataEntity.id) || [],
          viewFilters: viewFiltersByFieldId.get(fieldMetadataEntity.id) || [],
          viewGroups: viewGroupsByFieldId.get(fieldMetadataEntity.id) || [],
          kanbanAggregateOperationViews:
            kanbanViewsByFieldId.get(fieldMetadataEntity.id) || [],
          calendarViews:
            calendarViewsByFieldId.get(fieldMetadataEntity.id) || [],
        };

        const flatFieldMetadata = fromFieldMetadataEntityToFlatFieldMetadata(
          fieldMetadataWithRelations as any,
        );

        return addFlatEntityToFlatEntityMapsOrThrow({
          flatEntity: flatFieldMetadata,
          flatEntityMaps: flatFieldMetadataMaps,
        });
      },
      EMPTY_FLAT_ENTITY_MAPS,
    );
  }
}
