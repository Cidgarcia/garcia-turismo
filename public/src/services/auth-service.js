import { sessionService } from './session-service.js';
import { supabaseService } from './supabase-service.js';

const LOCAL_USERS = [
  { username: 'admin', password: '123456', label: 'Admin' },
  { username: 'junior', password: 'GARCIA2017', label: 'Junior' }
];

function normalizeUser(value = '') {
  return String(value).trim().toLowerCase();
}

function findLocalAccount(user, password) {
  return LOCAL_USERS.find((item) => (
    item.username === normalizeUser(user) && item.password === String(password).trim()
  ));
}

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
    const localAccount = findLocalAccount(user, password);
    if (localAccount) {
      this.setSession(true);
      return { mode: 'local', user: localAccount.label };
    }
    if (this.isCloudEnabled()) {
      const session = await supabaseService.signIn(String(user).trim(), String(password).trim());
      this.setSession(true);
      return { mode: 'supabase', user: session?.user?.email || user };
    }
    throw new Error('Usuario ou senha invalidos. Use admin / 123456 ou junior / GARCIA2017.');
  },
  async signOut() {
    if (this.isCloudEnabled()) {
      await supabaseService.flush();
      await supabaseService.signOut();
    }
    this.setSession(false);
  }
};
