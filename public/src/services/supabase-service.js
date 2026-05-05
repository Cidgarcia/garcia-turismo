import { SUPABASE_CONFIG } from "../config/supabase-config.js";

let client = null;
let saveTimer = null;
let lastSave = Promise.resolve(false);

function isPlaceholder(value = "") {
  return String(value).includes("COLE_AQUI") || !String(value).trim();
}

export function isConfigured() {
  return Boolean(
    SUPABASE_CONFIG.enabled &&
    !isPlaceholder(SUPABASE_CONFIG.url) &&
    !isPlaceholder(SUPABASE_CONFIG.anonKey),
  );
}

async function getClient() {
  if (!isConfigured()) return null;

  if (!client) {
    const { createClient } =
      await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");

    client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}

export const supabaseService = {
  isConfigured,

  async loadState() {
    const sb = await getClient();
    if (!sb) return null;

    const { data, error } = await sb
      .from(SUPABASE_CONFIG.tableName)
      .select("data")
      .eq("id", SUPABASE_CONFIG.stateId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar Supabase:", error);
      return null;
    }

    return data?.data || null;
  },

  async saveStateNow(appData) {
    const sb = await getClient();
    if (!sb) return false;

    const payload = {
      id: SUPABASE_CONFIG.stateId,
      data: appData,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb
      .from(SUPABASE_CONFIG.tableName)
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar no Supabase:", error);
      return false;
    }

    return true;
  },

  scheduleSave(appData) {
    if (!isConfigured()) return Promise.resolve(false);

    clearTimeout(saveTimer);

    lastSave = new Promise((resolve) => {
      saveTimer = setTimeout(async () => {
        resolve(await this.saveStateNow(appData));
      }, 600);
    });

    return lastSave;
  },

  async flush() {
    return lastSave;
  },

  async signIn() {
    return null;
  },

  async signOut() {
    return true;
  },

  async getSession() {
    return null;
  },
};
