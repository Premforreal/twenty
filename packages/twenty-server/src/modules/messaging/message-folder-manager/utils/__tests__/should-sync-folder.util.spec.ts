import { shouldSyncFolder } from 'src/modules/messaging/message-folder-manager/utils/should-sync-folder.util';
import { StandardFolder } from 'src/modules/messaging/message-import-manager/drivers/types/standard-folder';

describe('shouldSyncFolder', () => {
  describe('when syncAllFolders is false', () => {
    it('should sync inbox folder', () => {
      const result = shouldSyncFolder(StandardFolder.INBOX, false, true);

      expect(result).toBe(true);
    });

    it('should not sync non-inbox folders', () => {
      const result = shouldSyncFolder(StandardFolder.SENT, false, false);

      expect(result).toBe(false);
    });

    it('should not sync drafts folder', () => {
      const result = shouldSyncFolder(StandardFolder.DRAFTS, false, false);

      expect(result).toBe(false);
    });

    it('should not sync trash folder', () => {
      const result = shouldSyncFolder(StandardFolder.TRASH, false, false);

      expect(result).toBe(false);
    });

    it('should not sync junk folder', () => {
      const result = shouldSyncFolder(StandardFolder.JUNK, false, false);

      expect(result).toBe(false);
    });

    it('should not sync unknown folders', () => {
      const result = shouldSyncFolder(null, false, false);

      expect(result).toBe(false);
    });
  });

  describe('when syncAllFolders is true', () => {
    it('should sync inbox folder', () => {
      const result = shouldSyncFolder(StandardFolder.INBOX, true, true);

      expect(result).toBe(true);
    });

    it('should sync sent folder', () => {
      const result = shouldSyncFolder(StandardFolder.SENT, true, false);

      expect(result).toBe(true);
    });

    it('should sync unknown folders', () => {
      const result = shouldSyncFolder(null, true, false);

      expect(result).toBe(true);
    });

    it('should NOT sync drafts folder even with syncAllFolders', () => {
      const result = shouldSyncFolder(StandardFolder.DRAFTS, true, false);

      expect(result).toBe(false);
    });

    it('should NOT sync trash folder even with syncAllFolders', () => {
      const result = shouldSyncFolder(StandardFolder.TRASH, true, false);

      expect(result).toBe(false);
    });

    it('should NOT sync junk folder even with syncAllFolders', () => {
      const result = shouldSyncFolder(StandardFolder.JUNK, true, false);

      expect(result).toBe(false);
    });
  });
});
