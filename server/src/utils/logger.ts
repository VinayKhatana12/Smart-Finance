const stamp = (): string => new Date().toISOString();

export const logger = {
  info: (message: string): void => console.info(`[${stamp()}] info: ${message}`),
  warn: (message: string): void => console.warn(`[${stamp()}] warn: ${message}`),
  error: (message: string): void => console.error(`[${stamp()}] error: ${message}`),
};
