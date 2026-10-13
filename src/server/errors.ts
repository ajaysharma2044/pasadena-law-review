/** Errors that map to HTTP responses. `code` is a stable key the UI turns into a message. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export const unauthorized = (code = "sign_in_required") => new AppError(401, code, "Sign in to continue.");
export const forbidden = (code = "forbidden", message = "You don’t have permission to do that.") => new AppError(403, code, message);
export const notFound = (code = "not_found") => new AppError(404, code, "Not found.");
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const invalid = (message: string, fields?: Record<string, string>) => new AppError(422, "invalid", message, fields);
export const tooMany = (retryAfter: number) => new AppError(429, "rate_limited", `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
