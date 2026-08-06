import { sessionService } from "./session-service.js";
import { firebaseService } from "./firebase-service.js";

export const authService = {
  isCloudEnabled() {
    return firebaseService.isConfigured();
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

    const session = await firebaseService.signIn(
      String(user).trim(),
      String(password).trim(),
    );

    this.setSession(true);

    return {
      mode: "firebase",
      user: session?.user?.email || user,
      profile: session.profile,
    };
  },

  async signOut() {
    if (this.isCloudEnabled()) {
      await firebaseService.signOut();
    }

    this.setSession(false);
  },

  async getSession() {
    if (!this.isCloudEnabled()) return null;
    try {
      const profile = await firebaseService.getCurrentUserProfile();
      return { user: { uid: profile.uid, email: profile.email }, profile };
    } catch (error) {
      await firebaseService.signOut().catch(() => undefined);
      throw error;
    }
  },

  observeAuthState(callback) {
    return firebaseService.observeAuthState(callback);
  },
};
