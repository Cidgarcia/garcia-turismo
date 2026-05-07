import { sessionService } from "./session-service.js";
import { supabaseService } from "./supabase-service.js";

export const authService = {
  isCloudEnabled() {
    return supabaseService.isConfigured();
  },

  hasSession() {
    return sessionService.has();
  },

  setSession(value) {
    sessionService.set(Boolean(value));
  },

  async signIn(user, password) {
    if (!this.isCloudEnabled()) {
      throw new Error("Login em nuvem não configurado.");
    }

    const session = await supabaseService.signIn(
      String(user).trim(),
      String(password).trim(),
    );

    this.setSession(true);

    return {
      mode: "supabase",
      user: session?.user?.email || user,
    };
  },

  async signOut() {
    if (this.isCloudEnabled()) {
      await supabaseService.flush();
      await supabaseService.signOut();
    }

    this.setSession(false);
  },
};
