export type ServiceErrorCode =
  | 'not_found'
  | 'invalid_input'
  | 'invalid_category'
  | 'duplicate_name'
  | 'invalid_image'
  | 'no_total'
  | 'cannot_modify_self';

export class ServiceError extends Error {
  code: ServiceErrorCode;

  constructor(code: ServiceErrorCode) {
    super(code);
    this.code = code;
  }
}
