import { Module } from '@nestjs/common';

import { MessageChannelUpdateOnePreQueryHook } from 'src/modules/messaging/message-channel-manager/query-hooks/message-channel-update-one.pre-query.hook';
import { MessagingProcessGroupEmailActionsService } from 'src/modules/messaging/message-import-manager/services/messaging-process-group-email-actions.service';

@Module({
  providers: [
    MessageChannelUpdateOnePreQueryHook,
    MessagingProcessGroupEmailActionsService,
  ],
  exports: [MessageChannelUpdateOnePreQueryHook],
})
export class MessageChannelQueryHookModule {}
