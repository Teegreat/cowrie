// Plain Error subclass, no framework import — the domain layer throws
// this without knowing or caring that NestJS will eventually translate
// it into an HTTP response.

export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}
