import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { type WorkspaceEntityManager } from 'src/engine/twenty-orm/entity-manager/workspace-entity-manager';
import { TwentyORMManager } from 'src/engine/twenty-orm/twenty-orm.manager';
import { type MessageChannelWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel.workspace-entity';
import {
  MessageFolderPendingSyncAction,
  MessageFolderWorkspaceEntity,
} from 'src/modules/messaging/common/standard-objects/message-folder.workspace-entity';
import { MessagingDeleteFolderMessagesService } from 'src/modules/messaging/message-import-manager/services/messaging-delete-folder-messages.service';

@Injectable()
export class MessagingProcessFolderActionsService {
  private readonly logger = new Logger(
    MessagingProcessFolderActionsService.name,
  );

  constructor(
    private readonly twentyORMManager: TwentyORMManager,
    private readonly messagingDeleteFolderMessagesService: MessagingDeleteFolderMessagesService,
  ) {}

  async processFolderActions(
    messageChannel: MessageChannelWorkspaceEntity,
    messageFolders: MessageFolderWorkspaceEntity[],
    workspaceId: string,
  ): Promise<void> {
    const foldersWithPendingActions = messageFolders.filter(
      (folder) =>
        isDefined(folder.pendingSyncAction) &&
        folder.pendingSyncAction !== MessageFolderPendingSyncAction.NONE,
    );

    if (foldersWithPendingActions.length === 0) {
      return;
    }

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Processing ${foldersWithPendingActions.length} folders with pending actions`,
    );

    const workspaceDataSource = await this.twentyORMManager.getDatasource();

    await workspaceDataSource?.transaction(
      async (transactionManager: WorkspaceEntityManager) => {
        const messageFolderRepository =
          await this.twentyORMManager.getRepository<MessageFolderWorkspaceEntity>(
            'messageFolder',
          );

        const folderIdsToDelete: string[] = [];
        const folderIdsToImport: string[] = [];
        const processedFolderIds: string[] = [];

        for (const folder of foldersWithPendingActions) {
          try {
            this.logger.log(
              `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id}, FolderId: ${folder.id} - Processing folder action: ${folder.pendingSyncAction}`,
            );

            if (
              folder.pendingSyncAction ===
              MessageFolderPendingSyncAction.FOLDER_DELETION
            ) {
              await this.messagingDeleteFolderMessagesService.deleteFolderMessages(
                workspaceId,
                messageChannel,
                folder,
              );

              folderIdsToDelete.push(folder.id);

              this.logger.log(
                `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id}, FolderId: ${folder.id} - Completed FOLDER_DELETION action`,
              );
            } else if (
              folder.pendingSyncAction ===
              MessageFolderPendingSyncAction.FOLDER_IMPORT
            ) {
              folderIdsToImport.push(folder.id);

              this.logger.log(
                `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id}, FolderId: ${folder.id} - Marked for FOLDER_IMPORT action`,
              );
            }

            processedFolderIds.push(folder.id);
          } catch (error) {
            this.logger.error(
              `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id}, FolderId: ${folder.id} - Error processing folder action: ${error.message}`,
              error.stack,
            );
            throw error;
          }
        }

        if (folderIdsToImport.length > 0) {
          await messageFolderRepository.update(
            { id: In(folderIdsToImport) },
            { syncCursor: '' },
            transactionManager,
          );

          this.logger.log(
            `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Cleared sync cursors for ${folderIdsToImport.length} folders to import`,
          );
        }

        if (processedFolderIds.length > 0) {
          await messageFolderRepository.update(
            { id: In(processedFolderIds) },
            { pendingSyncAction: MessageFolderPendingSyncAction.NONE },
            transactionManager,
          );

          this.logger.log(
            `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Reset pendingSyncAction to NONE for ${processedFolderIds.length} folders`,
          );
        }

        if (folderIdsToDelete.length > 0) {
          await messageFolderRepository.update(
            { id: In(folderIdsToDelete) },
            { deletedAt: new Date().toISOString() },
            transactionManager,
          );
        }
      },
    );
  }
}
