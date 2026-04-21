const fallbackId = (): string => `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const createId = (): string => {
  const api = globalThis.crypto;
  if (api?.randomUUID) {
    return api.randomUUID();
  }

  return fallbackId();
};

export const nowIso = (): string => new Date().toISOString();
