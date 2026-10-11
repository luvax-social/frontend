const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const getErrorResponse = (error: unknown) =>
  isRecord(error) && isRecord(error.response) ? error.response : undefined;

export const getErrorData = (error: unknown) => {
  const data = getErrorResponse(error)?.data;
  return isRecord(data) ? data : undefined;
};

export const getErrorMessage = (error: unknown, fallback: string) =>
  isRecord(error) && typeof error.message === 'string' ? error.message : fallback;
