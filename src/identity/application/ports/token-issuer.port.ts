export abstract class TokenIssuer {
  abstract issueAccessToken(payload: { sub: string }): Promise<string>;
}
