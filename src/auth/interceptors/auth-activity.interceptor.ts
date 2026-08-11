import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';
import {
  concatMap,
  type Observable,
} from 'rxjs';

import {
  getSessionMetadata,
} from '../request-metadata';
import type {
  AuthenticatedRequest,
} from '../types/authenticated-request.types';

type AuthActivityConfig = {
  customerAction?: string;
  adminAction?: string;
  description: string;
};

const ACTIVITIES:
  Record<
    string,
    Record<
      string,
      AuthActivityConfig
    >
  > = {
    AuthController: {
      register: {
        customerAction:
          'CUSTOMER_REGISTERED',
        description:
          'Created customer account.',
      },

      login: {
        customerAction:
          'CUSTOMER_LOGIN',
        description:
          'Logged in.',
      },

      logout: {
        customerAction:
          'CUSTOMER_LOGOUT',
        description:
          'Logged out.',
      },

      changePassword: {
        customerAction:
          'PASSWORD_CHANGED',
        description:
          'Changed password.',
      },
    },

    GoogleAuthController: {
      login: {
        customerAction:
          'CUSTOMER_GOOGLE_LOGIN',
        description:
          'Logged in with Google.',
      },

      link: {
        customerAction:
          'GOOGLE_LINKED',
        description:
          'Linked Google authentication.',
      },
    },

    AuthManagementController: {
      unlinkGoogle: {
        customerAction:
          'GOOGLE_UNLINKED',
        description:
          'Unlinked Google authentication.',
      },

      setPassword: {
        customerAction:
          'PASSWORD_SET',
        description:
          'Created a local password.',
      },
    },

    AdminAuthController: {
      login: {
        adminAction:
          'ADMIN_LOGIN',
        description:
          'Logged in.',
      },

      logout: {
        adminAction:
          'ADMIN_LOGOUT',
        description:
          'Logged out.',
      },

      changePassword: {
        adminAction:
          'PASSWORD_CHANGED',
        description:
          'Changed password.',
      },
    },

    AdminGoogleAuthController: {
      login: {
        adminAction:
          'ADMIN_GOOGLE_LOGIN',
        description:
          'Logged in with Google.',
      },

      link: {
        adminAction:
          'GOOGLE_LINKED',
        description:
          'Linked Google authentication.',
      },
    },

    AdminAuthManagementController: {
      unlinkGoogle: {
        adminAction:
          'GOOGLE_UNLINKED',
        description:
          'Unlinked Google authentication.',
      },

      setPassword: {
        adminAction:
          'PASSWORD_SET',
        description:
          'Created a local password.',
      },
    },
  };

@Injectable()
export class AuthActivityInterceptor
  implements NestInterceptor
{
  private readonly logger =
    new Logger(
      AuthActivityInterceptor.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const className =
      context.getClass().name;

    const handlerName =
      context.getHandler().name;

    const config =
      ACTIVITIES[className]?.[
        handlerName
      ];

    if (!config) {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    return next.handle().pipe(
      concatMap(
        async (
          response: unknown,
        ) => {
          const identity =
            resolveIdentity(
              request,
              response,
            );

          if (!identity) {
            return response;
          }

          const action =
            identity.role ===
              'CUSTOMER'
              ? config
                  .customerAction
              : config.adminAction;

          if (!action) {
            return response;
          }

          const metadata =
            getSessionMetadata(
              request,
            );

          try {
            await this.prisma
              .userActivity
              .create({
                data: {
                  subjectUserId:
                    identity.id,
                  actorUserId:
                    identity.id,
                  action:
                    identity.role ===
                      'SUPERADMIN' &&
                    action ===
                      'ADMIN_LOGIN'
                      ? 'SUPERADMIN_LOGIN'
                      : action,
                  resourceType:
                    'USER',
                  resourceId:
                    identity.id,
                  description:
                    config.description,
                  ipAddress:
                    metadata.ipAddress,
                  userAgent:
                    metadata.userAgent,
                },
              });
          } catch (
            error: unknown
          ) {
            this.logger.error(
              `Authentication activity persistence failed. action=${action}`,
            );

            if (
              error instanceof
              Error
            ) {
              this.logger.error(
                error.message,
              );
            }
          }

          return response;
        },
      ),
    );
  }
}

function resolveIdentity(
  request:
    AuthenticatedRequest,
  response: unknown,
): {
  id: string;
  role:
    | 'CUSTOMER'
    | 'ADMIN'
    | 'SUPERADMIN';
} | null {
  if (request.auth) {
    return {
      id:
        request.auth.id,
      role:
        request.auth.role,
    };
  }

  if (
    typeof response !==
      'object' ||
    response === null ||
    !('user' in response)
  ) {
    return null;
  }

  const candidate =
    response as {
      user?: unknown;
    };

  if (
    typeof candidate.user !==
      'object' ||
    candidate.user === null
  ) {
    return null;
  }

  const user =
    candidate.user as {
      id?: unknown;
      role?: unknown;
    };

  if (
    typeof user.id !==
      'string' ||
    (
      user.role !==
        'CUSTOMER' &&
      user.role !==
        'ADMIN' &&
      user.role !==
        'SUPERADMIN'
    )
  ) {
    return null;
  }

  return {
    id:
      user.id,
    role:
      user.role,
  };
}
