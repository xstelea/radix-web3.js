export class GatewayError {
  readonly _tag = "GatewayError";
  constructor(readonly error: unknown) {}
}

export class EntityNotFoundError {
  readonly _tag = "EntityNotFoundError";
  constructor(readonly error?: unknown) {}
}

export class InvalidInputError {
  readonly _tag = "InvalidInputError";
  constructor(readonly error: unknown) {}
}
