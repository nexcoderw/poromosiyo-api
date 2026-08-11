import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  OAuth2Client,
} from 'google-auth-library';

import type {
  VerifiedGoogleIdentity,
} from '../types/google-auth.types';

@Injectable()
export class GoogleIdTokenVerifierService {
  private readonly client =
    new OAuth2Client();

  constructor(
    private readonly config:
      ConfigService,
  ) {}

  async verify(
    idToken: string,
  ): Promise<VerifiedGoogleIdentity> {
    const enabled =
      this.config.get<boolean>(
        'GOOGLE_AUTH_ENABLED',
      ) ?? false;

    const clientId =
      this.config
        .get<string>(
          'GOOGLE_CLIENT_ID',
        )
        ?.trim() ?? '';

    if (
      !enabled ||
      !clientId
    ) {
      throw new ServiceUnavailableException(
        'Google authentication is not configured.',
      );
    }

    try {
      const ticket =
        await this.client
          .verifyIdToken({
            idToken,
            audience:
              clientId,
          });

      const payload =
        ticket.getPayload();

      if (!payload) {
        throwInvalidGoogleCredential();
      }

      const subject =
        payload.sub?.trim();

      const email =
        payload.email
          ?.trim()
          .toLowerCase();

      if (
        !subject ||
        subject.length > 255 ||
        !email ||
        email.length > 254 ||
        payload.email_verified !== true
      ) {
        throwInvalidGoogleCredential();
      }

      return {
        subject,
        email,
        emailVerified:
          true,
        emailAuthoritative:
          isAuthoritativeGoogleEmail(
            email,
            payload.hd,
          ),
        fullName:
          resolveFullName(
            payload.name,
            payload.given_name,
            payload.family_name,
            email,
          ),
        image:
          resolveImage(
            payload.picture,
          ),
      };
    } catch (
      error: unknown
    ) {
      if (
        error instanceof
          ServiceUnavailableException ||
        error instanceof
          UnauthorizedException
      ) {
        throw error;
      }

      throwInvalidGoogleCredential();
    }
  }
}

function isAuthoritativeGoogleEmail(
  email: string,
  hostedDomain:
    | string
    | undefined,
): boolean {
  return (
    email.endsWith(
      '@gmail.com',
    ) ||
    (
      typeof hostedDomain ===
        'string' &&
      hostedDomain.trim().length >
        0
    )
  );
}

function resolveFullName(
  name:
    | string
    | undefined,
  givenName:
    | string
    | undefined,
  familyName:
    | string
    | undefined,
  email: string,
): string {
  const supplied =
    normalizeName(
      name ??
        [
          givenName,
          familyName,
        ]
          .filter(Boolean)
          .join(' '),
    );

  if (supplied) {
    return supplied.slice(
      0,
      150,
    );
  }

  const localPart =
    email.split('@')[0] ??
    'Google User';

  const fallback =
    normalizeName(
      localPart.replace(
        /[._+-]+/g,
        ' ',
      ),
    );

  return (
    fallback ||
    'Google User'
  ).slice(0, 150);
}

function normalizeName(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, ' ');
}

function resolveImage(
  value:
    | string
    | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    if (
      url.protocol !==
        'https:' &&
      url.protocol !==
        'http:'
    ) {
      return null;
    }

    return value.slice(
      0,
      2048,
    );
  } catch {
    return null;
  }
}

function throwInvalidGoogleCredential(): never {
  throw new UnauthorizedException(
    'Invalid Google credential.',
  );
}
