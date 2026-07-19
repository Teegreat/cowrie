// This is the port. Lives in the application layer because the
// application layer is what decides it needs an external banking
// connection at all. Abstract class, not a TS `interface`, because
// interfaces vanish at runtime and can't be used as a NestJS DI token.

export abstract class BaaSGateway {
  abstract ping(): Promise<string>;
}
