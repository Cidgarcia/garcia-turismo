import { APP_CONFIG } from "../config/app-config.js";

export const sessionService = {
  set(value) {
    if (value) {
      localStorage.setItem(APP_CONFIG.sessionKey, "1");
    } else {
      this.clear();
    }
  },

  has() {
    return localStorage.getItem(APP_CONFIG.sessionKey) === "1";
  },

  clear() {
    localStorage.removeItem(APP_CONFIG.sessionKey);
    localStorage.removeItem("garcia-turismo-supabase-auth");
  },
};
