export type ServiceErrorCode =
  | 'not_found'
  | 'invalid_input'
  | 'invalid_category'
  | 'duplicate_name'
  | 'invalid_image'
  | 'no_total';

export class ServiceError extends Error {
  code: ServiceErrorCode;

  constructor(code: ServiceErrorCode) {
    super(code);
    this.code = code;
  }
}
