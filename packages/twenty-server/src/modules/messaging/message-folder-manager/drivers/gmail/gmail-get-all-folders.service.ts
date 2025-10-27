import { Injectable, Logger } from '@nestjs/common';

import {
  MessageFolder,
  MessageFolderDriver,
} from 'src/modules/messaging/message-folder-manager/interfaces/message-folder-driver.interface';

import { OAuth2ClientManagerService } from 'src/modules/connected-account/oauth2-client-manager/services/oauth2-client-manager.service';
import { type ConnectedAccountWorkspaceEntity } from 'src/modules/connected-account/standard-objects/connected-account.workspace-entity';
import { MessageChannelWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel.workspace-entity';
import { shouldSyncFolder } from 'src/modules/messaging/message-folder-manager/utils/should-sync-folder.util';
import { MESSAGING_GMAIL_DEFAULT_NOT_SYNCED_LABELS } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/messaging-gmail-default-not-synced-labels';
import { GmailHandleErrorService } from 'src/modules/messaging/message-import-manager/drivers/gmail/services/gmail-handle-error.service';
import { getStandardFolderByRegex } from 'src/modules/messaging/message-import-manager/drivers/utils/get-standard-folder-by-regex';

@Injectable()
export class GmailGetAllFoldersService implements MessageFolderDriver {
  private readonly logger = new Logger(GmailGetAllFoldersService.name);

  constructor(
    private readonly oAuth2ClientManagerService: OAuth2ClientManagerService,
    private readonly gmailHandleErrorService: GmailHandleErrorService,
  ) {}

  private shouldExcludeLabel(labelId: string): boolean {
    return MESSAGING_GMAIL_DEFAULT_NOT_SYNCED_LABELS.includes(labelId);
  }

  async getAllMessageFolders(
    connectedAccount: Pick<
      ConnectedAccountWorkspaceEntity,
      'provider' | 'refreshToken' | 'accessToken' | 'id' | 'handle'
    >,
    messageChannel: Pick<MessageChannelWorkspaceEntity, 'syncAllFolders'>,
  ): Promise<MessageFolder[]> {
    try {
      const oAuth2Client =
        await this.oAuth2ClientManagerService.getGoogleOAuth2Client(
          connectedAccount,
        );

      const gmailClient = oAuth2Client.gmail({ version: 'v1' });

      const response = await gmailClient.users.labels
        .list({ userId: 'me' })
        .catch((error) => {
          this.logger.error(
            `Connected account ${connectedAccount.id}: Error fetching labels: ${error.message}`,
          );

          this.gmailHandleErrorService.handleGmailMessageListFetchError(error);

          return { data: { labels: [] } };
        });

      const labels = response.data.labels || [];

      const folders: MessageFolder[] = [];

      for (const label of labels) {
        if (!label.name || !label.id) {
          continue;
        }

        if (this.shouldExcludeLabel(label.id)) {
          continue;
        }

        const isSentFolder = label.id === 'SENT';
        const isInbox = label.id === 'INBOX';

        const standardFolder = getStandardFolderByRegex(label.name);
        const isSynced = shouldSyncFolder(
          standardFolder,
          messageChannel.syncAllFolders,
          isInbox,
        );

        folders.push({
          externalId: label.id,
          name: label.name,
          isSynced,
          isSentFolder,
        });
      }

      this.logger.log(
        `Found ${folders.length} folders for Gmail account ${connectedAccount.handle}`,
      );

      return folders;
    } catch (error) {
      this.logger.error(
        `Failed to get Gmail folders for account ${connectedAccount.handle}:`,
        error,
      );

      throw error;
    }
  }
}
