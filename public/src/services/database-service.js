import { storageService } from './storage-service.js';
import { supabaseService } from './supabase-service.js';

export const databaseService = {
  isCloudEnabled() {
    return supabaseService.isConfigured();
  },

  loadLocal() {
    return storageService.load();
  },

  saveLocal(data) {
    return storageService.save(data);
  },

  persist(data) {
    const normalized = storageService.save(data);
    storageService.maybeAutoBackup(normalized);
    supabaseService.scheduleSave(normalized);
    return normalized;
  },

  async loadRemote() {
    if (!this.isCloudEnabled()) return null;
    return supabaseService.loadState();
  },

  async saveRemoteNow(data) {
    if (!this.isCloudEnabled()) return false;
    return supabaseService.saveStateNow(data);
  },

  async flush() {
    return supabaseService.flush();
  }
};
