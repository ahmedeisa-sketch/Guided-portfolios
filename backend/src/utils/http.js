export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
