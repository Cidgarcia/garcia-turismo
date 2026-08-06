import { APP_CONFIG } from "../config/app-config.js";

export const storageService = {
  exportJson(data) {
    return JSON.stringify(data, null, 2);
  },

  downloadBackup(data, fileName = APP_CONFIG.backupFileName) {
    const blob = new Blob([this.exportJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
};
