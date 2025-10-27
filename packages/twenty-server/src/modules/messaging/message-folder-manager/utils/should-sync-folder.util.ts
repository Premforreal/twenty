import { MESSAGING_FOLDER_MANAGER_ALWAYS_EXCLUDED_FOLDERS } from 'src/modules/messaging/message-folder-manager/utils/MESSAGING_FOLDER_MANAGER_ALWAYS_EXCLUDED_FOLDERS';
import { type StandardFolder } from 'src/modules/messaging/message-import-manager/drivers/types/standard-folder';

export const shouldSyncFolder = (
  standardFolder: StandardFolder | null,
  syncAllFolders: boolean,
  isInbox: boolean = false,
): boolean => {
  if (
    standardFolder &&
    MESSAGING_FOLDER_MANAGER_ALWAYS_EXCLUDED_FOLDERS.includes(
      standardFolder as StandardFolder,
    )
  ) {
    return false;
  }

  if (syncAllFolders) {
    return true;
  }

  return isInbox;
};
