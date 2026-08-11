import { firebaseService } from "./firebase-service.js";

export function createDatabaseService(firebaseAdapter = firebaseService) {
  return {
    isCloudEnabled() {
      return firebaseAdapter.isConfigured();
    },

    loadLocal() {
      return null;
    },

    saveLocal(data) {
      return data;
    },

    clearLocal() {
      // Dados operacionais vivem somente no Firestore. Não há estado autoritativo local.
    },

    async loadRemote() {
      if (!this.isCloudEnabled()) return null;
      return firebaseAdapter.loadOperationalData();
    },

    async create(collection, payload) {
      const method = `create${collection}`;
      return firebaseAdapter[method](payload);
    },

    async update(collection, id, payload) {
      const method = `update${collection}`;
      return firebaseAdapter[method](id, payload);
    },

    async remove(collection, id) {
      const method = `delete${collection}`;
      return firebaseAdapter[method](id);
    },
  };
}

export const databaseService = createDatabaseService();
