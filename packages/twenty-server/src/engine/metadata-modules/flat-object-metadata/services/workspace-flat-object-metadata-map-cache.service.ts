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
import { FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { fromObjectMetadataEntityToFlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/utils/from-object-metadata-entity-to-flat-object-metadata.util';
import { IndexMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-metadata.entity';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { ViewEntity } from 'src/engine/metadata-modules/view/entities/view.entity';
import { WorkspaceFlatMapCache } from 'src/engine/workspace-flat-map-cache/decorators/workspace-flat-map-cache.decorator';
import { WorkspaceFlatMapCacheService } from 'src/engine/workspace-flat-map-cache/services/workspace-flat-map-cache.service';

@Injectable()
@WorkspaceFlatMapCache('flatObjectMetadataMaps')
export class WorkspaceFlatObjectMetadataMapCacheService extends WorkspaceFlatMapCacheService<
  FlatEntityMaps<FlatObjectMetadata>
> {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    cacheStorageService: CacheStorageService,

    @InjectRepository(ObjectMetadataEntity)
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    @InjectRepository(IndexMetadataEntity)
    private readonly indexMetadataRepository: Repository<IndexMetadataEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>,
  ) {
    super(cacheStorageService);
  }

  protected async computeFlatMap({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatEntityMaps<FlatObjectMetadata>> {
    // Fetch all entities for workspace in parallel
    const [objectMetadatas, fields, indexMetadatas, views] = await Promise.all([
      this.objectMetadataRepository.find({
        where: { workspaceId },
        withDeleted: true,
      }),
      this.fieldMetadataRepository.find({
        where: { workspaceId },
        select: ['id', 'objectMetadataId'],
        withDeleted: true,
      }),
      this.indexMetadataRepository.find({
        where: { workspaceId },
        select: ['id', 'objectMetadataId'],
        withDeleted: true,
      }),
      this.viewRepository.find({
        where: { workspaceId },
        select: ['id', 'objectMetadataId'],
        withDeleted: true,
      }),
    ]);

    if (objectMetadatas.length === 0) {
      return EMPTY_FLAT_ENTITY_MAPS;
    }

    // Build maps of objectMetadataId -> related IDs
    const fieldsByObjectId = new Map<string, { id: string }[]>();
    const indexesByObjectId = new Map<string, { id: string }[]>();
    const viewsByObjectId = new Map<string, { id: string }[]>();

    for (const field of fields) {
      if (!fieldsByObjectId.has(field.objectMetadataId)) {
        fieldsByObjectId.set(field.objectMetadataId, []);
      }
      fieldsByObjectId.get(field.objectMetadataId)!.push({ id: field.id });
    }

    for (const index of indexMetadatas) {
      if (!indexesByObjectId.has(index.objectMetadataId)) {
        indexesByObjectId.set(index.objectMetadataId, []);
      }
      indexesByObjectId.get(index.objectMetadataId)!.push({ id: index.id });
    }

    for (const view of views) {
      if (!viewsByObjectId.has(view.objectMetadataId)) {
        viewsByObjectId.set(view.objectMetadataId, []);
      }
      viewsByObjectId.get(view.objectMetadataId)!.push({ id: view.id });
    }

    // Build object metadata entities with relations
    return objectMetadatas.reduce(
      (flatObjectMetadataMaps, objectMetadataEntity) => {
        const objectMetadataWithRelations = {
          ...objectMetadataEntity,
          fields: fieldsByObjectId.get(objectMetadataEntity.id) || [],
          indexMetadatas: indexesByObjectId.get(objectMetadataEntity.id) || [],
          views: viewsByObjectId.get(objectMetadataEntity.id) || [],
        };

        const flatObjectMetadata =
          fromObjectMetadataEntityToFlatObjectMetadata(
            objectMetadataWithRelations as any,
          );

        return addFlatEntityToFlatEntityMapsOrThrow({
          flatEntity: flatObjectMetadata,
          flatEntityMaps: flatObjectMetadataMaps,
        });
      },
      EMPTY_FLAT_ENTITY_MAPS,
    );
  }
}
