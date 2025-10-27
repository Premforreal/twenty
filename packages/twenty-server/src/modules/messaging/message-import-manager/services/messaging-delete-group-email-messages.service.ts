// TODO: Optimize query
import { Injectable, Logger } from '@nestjs/common';

import chunk from 'lodash.chunk';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel-message-association.workspace-entity';
import { type MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessagingMessageCleanerService } from 'src/modules/messaging/message-cleaner/services/messaging-message-cleaner.service';
import { isGroupEmail } from 'src/modules/messaging/message-import-manager/utils/is-group-email';

const MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_BATCH_SIZE = 500;

@Injectable()
export class MessagingDeleteGroupEmailMessagesService {
  private readonly logger = new Logger(
    MessagingDeleteGroupEmailMessagesService.name,
  );

  constructor(
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly messagingMessageCleanerService: MessagingMessageCleanerService,
  ) {}

  async deleteGroupEmailMessages(
    workspaceId: string,
    messageChannelId: string,
  ): Promise<number> {
    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannelId} - Deleting messages from group email addresses`,
    );

    const messageParticipantRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace<MessageParticipantWorkspaceEntity>(
        workspaceId,
        'messageParticipant',
      );

    const messageChannelMessageAssociationRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace<MessageChannelMessageAssociationWorkspaceEntity>(
        workspaceId,
        'messageChannelMessageAssociation',
      );

    let offset = 0;
    let totalDeletedCount = 0;

    while (true) {
      const associations =
        await messageChannelMessageAssociationRepository.find({
          where: {
            messageChannelId,
          },
          select: ['messageId', 'messageExternalId'],
          take: MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_BATCH_SIZE,
          skip: offset,
        });

      if (associations.length === 0) {
        break;
      }

      const messageIds = associations.map((assoc) => assoc.messageId);

      const messageParticipants = await messageParticipantRepository.find({
        where: {
          messageId: In(messageIds),
          role: 'from',
        },
        select: ['id', 'handle', 'messageId'],
      });

      const groupEmailParticipants = messageParticipants.filter(
        (participant) =>
          isDefined(participant.handle) && isGroupEmail(participant.handle),
      );

      if (groupEmailParticipants.length > 0) {
        const groupEmailMessageIds = new Set(
          groupEmailParticipants.map((p) => p.messageId),
        );

        const messageExternalIdsToDelete = associations
          .filter((assoc) => groupEmailMessageIds.has(assoc.messageId))
          .map((assoc) => assoc.messageExternalId)
          .filter(isDefined);

        if (messageExternalIdsToDelete.length > 0) {
          const messageExternalIdsChunks = chunk(
            messageExternalIdsToDelete,
            200,
          );

          for (const messageExternalIdsChunk of messageExternalIdsChunks) {
            await this.messagingMessageCleanerService.deleteMessagesChannelMessageAssociationsAndRelatedOrphans(
              {
                workspaceId,
                messageExternalIds: messageExternalIdsChunk,
                messageChannelId,
              },
            );

            totalDeletedCount += messageExternalIdsChunk.length;

            this.logger.log(
              `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannelId} - Deleted ${messageExternalIdsChunk.length} group email messages`,
            );
          }
        }
      }

      if (
        associations.length < MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_BATCH_SIZE
      ) {
        break;
      }

      offset += MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_BATCH_SIZE;
    }

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannelId} - Completed deleting ${totalDeletedCount} group email messages`,
    );

    return totalDeletedCount;
  }
}
