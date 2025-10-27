import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { TwentyORMManager } from 'src/engine/twenty-orm/twenty-orm.manager';
import {
  MessageChannelPendingGroupEmailsAction,
  MessageChannelWorkspaceEntity,
} from 'src/modules/messaging/common/standard-objects/message-channel.workspace-entity';
import { MessagingClearCursorsService } from 'src/modules/messaging/message-import-manager/services/messaging-clear-cursors.service';
import { MessagingDeleteGroupEmailMessagesService } from 'src/modules/messaging/message-import-manager/services/messaging-delete-group-email-messages.service';

@Injectable()
export class MessagingProcessGroupEmailActionsService {
  private readonly logger = new Logger(
    MessagingProcessGroupEmailActionsService.name,
  );

  constructor(
    private readonly twentyORMManager: TwentyORMManager,
    private readonly messagingDeleteGroupEmailMessagesService: MessagingDeleteGroupEmailMessagesService,
    private readonly messagingClearCursorsService: MessagingClearCursorsService,
  ) {}

  async markMessageChannelAsPendingGroupEmailsAction(
    messageChannel: MessageChannelWorkspaceEntity,
    workspaceId: string,
    pendingGroupEmailsAction: MessageChannelPendingGroupEmailsAction,
  ): Promise<void> {
    const messageChannelRepository =
      await this.twentyORMManager.getRepository<MessageChannelWorkspaceEntity>(
        'messageChannel',
      );

    await messageChannelRepository.update(
      { id: messageChannel.id },
      { pendingGroupEmailsAction },
    );

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Marked message channel as pending group emails action: ${pendingGroupEmailsAction}`,
    );
  }

  async processGroupEmailActions(
    messageChannel: MessageChannelWorkspaceEntity,
    workspaceId: string,
  ): Promise<void> {
    const { pendingGroupEmailsAction } = messageChannel;

    if (
      !isDefined(pendingGroupEmailsAction) ||
      pendingGroupEmailsAction === MessageChannelPendingGroupEmailsAction.NONE
    ) {
      return;
    }

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Processing group email action: ${pendingGroupEmailsAction}`,
    );

    try {
      const messageChannelRepository =
        await this.twentyORMManager.getRepository<MessageChannelWorkspaceEntity>(
          'messageChannel',
        );

      switch (pendingGroupEmailsAction) {
        case MessageChannelPendingGroupEmailsAction.GROUP_EMAILS_DELETION:
          await this.handleGroupEmailsDeletion(workspaceId, messageChannel.id);
          break;
        case MessageChannelPendingGroupEmailsAction.GROUP_EMAILS_IMPORT:
          await this.handleGroupEmailsImport(workspaceId, messageChannel.id);
          break;
      }

      // TODO: this may or may not work and Im very sleepy so will investigate later
      await messageChannelRepository.update(
        { id: messageChannel.id },
        {
          pendingGroupEmailsAction: MessageChannelPendingGroupEmailsAction.NONE,
        },
      );

      this.logger.log(
        `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Reset pendingGroupEmailsAction to NONE`,
      );
    } catch (error) {
      this.logger.error(
        `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannel.id} - Error processing group email action: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleGroupEmailsDeletion(
    workspaceId: string,
    messageChannelId: string,
  ): Promise<void> {
    await this.messagingDeleteGroupEmailMessagesService.deleteGroupEmailMessages(
      workspaceId,
      messageChannelId,
    );

    await this.messagingClearCursorsService.clearAllCursors(messageChannelId);

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannelId} - Completed GROUP_EMAILS_DELETION action`,
    );
  }

  private async handleGroupEmailsImport(
    workspaceId: string,
    messageChannelId: string,
  ): Promise<void> {
    await this.messagingClearCursorsService.clearAllCursors(messageChannelId);

    this.logger.log(
      `WorkspaceId: ${workspaceId}, MessageChannelId: ${messageChannelId} - Completed GROUP_EMAILS_IMPORT action`,
    );
  }
}
