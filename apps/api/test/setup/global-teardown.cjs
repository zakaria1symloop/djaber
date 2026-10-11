module.exports = async () => {
  if (globalThis.__PG__) await globalThis.__PG__.stop().catch(() => undefined);
  if (globalThis.__REDIS__) await globalThis.__REDIS__.stop().catch(() => undefined);
};
