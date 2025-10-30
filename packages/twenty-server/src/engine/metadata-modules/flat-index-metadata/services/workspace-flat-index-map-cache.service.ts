import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { EMPTY_FLAT_ENTITY_MAPS } from 'src/engine/metadata-modules/flat-entity/constant/empty-flat-entity-maps.constant';
import { FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { fromIndexMetadataEntityToFlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/utils/from-index-metadata-entity-to-flat-index-metadata.util';
import { IndexFieldMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-field-metadata.entity';
import { IndexMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-metadata.entity';
import { WorkspaceFlatMapCache } from 'src/engine/workspace-flat-map-cache/decorators/workspace-flat-map-cache.decorator';
import { WorkspaceFlatMapCacheService } from 'src/engine/workspace-flat-map-cache/services/workspace-flat-map-cache.service';

@Injectable()
@WorkspaceFlatMapCache('flatIndexMaps')
export class WorkspaceFlatIndexMapCacheService extends WorkspaceFlatMapCacheService<
  FlatEntityMaps<FlatIndexMetadata>
> {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    cacheStorageService: CacheStorageService,
    @InjectRepository(IndexMetadataEntity)
    private readonly indexMetadataRepository: Repository<IndexMetadataEntity>,
    @InjectRepository(IndexFieldMetadataEntity)
    private readonly indexFieldMetadataRepository: Repository<IndexFieldMetadataEntity>,
  ) {
    super(cacheStorageService);
  }

  protected async computeFlatMap({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatEntityMaps<FlatIndexMetadata>> {
    // Fetch all entities for workspace in parallel
    // Note: IndexFieldMetadataEntity doesn't have workspaceId, so we fetch all
    const [indexes, indexFieldMetadatas] = await Promise.all([
      this.indexMetadataRepository.find({
        where: { workspaceId },
        withDeleted: true,
      }),
      this.indexFieldMetadataRepository.find(),
    ]);

    if (indexes.length === 0) {
      return EMPTY_FLAT_ENTITY_MAPS;
    }

    // Build map of indexMetadataId -> indexFieldMetadatas
    const indexFieldsByIndexId = new Map<
      string,
      IndexFieldMetadataEntity[]
    >();

    for (const indexField of indexFieldMetadatas) {
      if (!indexFieldsByIndexId.has(indexField.indexMetadataId)) {
        indexFieldsByIndexId.set(indexField.indexMetadataId, []);
      }
      indexFieldsByIndexId.get(indexField.indexMetadataId)!.push(indexField);
    }

    // Build index metadata entities with relations
    return indexes.reduce((flatIndexMaps, indexEntity) => {
      const indexEntityWithRelations = {
        ...indexEntity,
        indexFieldMetadatas:
          indexFieldsByIndexId.get(indexEntity.id) || [],
      };

      const flatIndex = fromIndexMetadataEntityToFlatIndexMetadata(
        indexEntityWithRelations,
      );

      return addFlatEntityToFlatEntityMapsOrThrow({
        flatEntity: flatIndex,
        flatEntityMaps: flatIndexMaps,
      });
    }, EMPTY_FLAT_ENTITY_MAPS);
  }
}
