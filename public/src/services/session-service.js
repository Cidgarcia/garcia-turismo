let active = false;
export const sessionService = {
  set(value) {
    active = Boolean(value);
  },

  has() {
    return active;
  },

  clear() {
    active = false;
  },
};
