// A configuração Web do Firebase é pública e identifica somente o aplicativo
// cliente. Contas de serviço e chaves administrativas ficam exclusivamente
// nos secrets usados pelos scripts de backend.
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCCdbuShWRTZ0vfn_uKSFQBjYMacXLeBwY",
  authDomain: "garciaturismopnz.firebaseapp.com",
  projectId: "garciaturismopnz",
  storageBucket: "garciaturismopnz.firebasestorage.app",
  messagingSenderId: "590301828797",
  appId: "1:590301828797:web:d6c80f421b669beba009d4",
});

export const FIREBASE_COMPANY_ID = "garcia-turismo";

export function isFirebaseConfigReady() {
  return Boolean(
    FIREBASE_CONFIG.apiKey
      && FIREBASE_CONFIG.authDomain
      && FIREBASE_CONFIG.projectId
      && FIREBASE_CONFIG.appId,
  );
}

export function firebaseConfigurationError() {
  return "A configuração do aplicativo Web Firebase está incompleta.";
}
