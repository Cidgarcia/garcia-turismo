import { firebaseService } from "./firebase-service.js";

export const databaseService = {
  isCloudEnabled() {
    return firebaseService.isConfigured();
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
    return firebaseService.loadOperationalData();
  },

  async create(collection, payload) {
    const method = `create${collection}`;
    return firebaseService[method](payload);
  },

  async update(collection, id, payload) {
    const method = `update${collection}`;
    return firebaseService[method](id, payload);
  },

  async remove(collection, id) {
    const method = `delete${collection}`;
    return firebaseService[method](id);
  }
};
