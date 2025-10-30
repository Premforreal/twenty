import { MetadataEntity } from 'src/engine/metadata-modules/flat-entity/types/metadata-entity.type';
import { MetadataOneToManyRelatedMetadataNames } from 'src/engine/metadata-modules/flat-entity/types/prastoin-target-relation.type';
import { AllMetadataName } from 'twenty-shared/metadata';
import { Repository } from 'typeorm';

type RelatedRepository<T extends AllMetadataName> = {
  [P in MetadataOneToManyRelatedMetadataNames<T>]: {
    repository: Repository<MetadataEntity<P>>;
    foreignKeys: Array<keyof MetadataEntity<P>>; // TODO could improve and plug to constants
  };
};
export async function loadFlatEntityAndRelatedFlatEntitiesIds<
  T extends AllMetadataName,
>({
  sourceEntityRepository,
  targetRepositoriesAndKeys,
  workspaceId,
}: {
  targetRepositoriesAndKeys: RelatedRepository<T>;
  workspaceId: string;
  sourceEntityRepository: Repository<MetadataEntity<T>>;
}) {
  const relatedMetadataNames = Object.keys(targetRepositoriesAndKeys) as Array<
    MetadataOneToManyRelatedMetadataNames<T>
  >;

  const [sourceEntities, ...targetsEntities] = await Promise.all([
    sourceEntityRepository.find({
      // @ts-expect-error TODO
      where: { workspaceId },
      withDeleted: true,
    }),
    ...relatedMetadataNames.map(async (relatedMetadataName) => {
      const { repository, foreignKeys } =
        targetRepositoriesAndKeys[relatedMetadataName];
      return {
        metadataName: relatedMetadataName,
        foreignKeys,
        entities: repository.find({
          // @ts-expect-error TODO
          where: {
            workspaceId,
          },
          withDeleted: true,
          // @ts-expect-error TODO
          select: ['id', ...foreignKeys],
        }),
      };
    }),
  ]);

  return {
    sourceEntities,
    targetsEntities
  }
}
