export class TransformationContractViolationError extends Error {
  code: string;
  constructor(message: string, code = 'TRANSFORM_CONTRACT') {
    super(message);
    this.name = 'TransformationContractViolationError';
    this.code = code;
  }
}
