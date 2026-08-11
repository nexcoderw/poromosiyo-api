import { TokenHasherService } from './token-hasher.service';

describe('TokenHasherService', () => {
  const service = new TokenHasherService();

  it('creates high-entropy opaque tokens', () => {
    const first =
      service.createToken();

    const second =
      service.createToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(32);
  });

  it('creates SHA-256 hexadecimal hashes', () => {
    const hash =
      service.hashToken(
        'poromosiyo-token',
      );

    expect(hash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it('verifies matching token hashes', () => {
    const token =
      service.createToken();

    const hash =
      service.hashToken(token);

    expect(
      service.verifyToken(token, hash),
    ).toBe(true);

    expect(
      service.verifyToken(
        'different-token',
        hash,
      ),
    ).toBe(false);
  });
});
