
import { storageService } from './storage-service.js';

export const backupService = {
  exportNow(data) {
    storageService.downloadBackup(data);
    return storageService.maybeAutoBackup(data);
  }
};
