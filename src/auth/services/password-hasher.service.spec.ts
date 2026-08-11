import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();

  it('hashes and verifies a password', async () => {
    const password = 'Poromosiyo-secure-password-123!';

    const passwordHash = await service.hash(password);

    expect(passwordHash).not.toBe(password);

    await expect(service.verify(passwordHash, password)).resolves.toBe(true);
  });

  it('rejects a different password', async () => {
    const passwordHash = await service.hash('Poromosiyo-secure-password-123!');

    await expect(
      service.verify(passwordHash, 'Wrong-password-123!'),
    ).resolves.toBe(false);
  });

  it('performs dummy verification without a local password', async () => {
    await expect(
      service.verifyOrDummy(null, 'Poromosiyo-secure-password-123!'),
    ).resolves.toBe(false);
  });
});
