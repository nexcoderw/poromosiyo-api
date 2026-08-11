import {
  Injectable,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type {
  Transporter,
} from 'nodemailer';

import type {
  AuthRole,
} from '../types/auth.types';

export type AuthMailKind =
  | 'email_verification'
  | 'password_reset'
  | 'password_changed';

type MemoryMail = {
  kind: AuthMailKind;
  email: string;
  token: string | null;
};

@Injectable()
export class AuthMailService {
  private readonly mode:
    | 'memory'
    | 'smtp';

  private readonly transporter:
    Transporter | null;

  private readonly from: string;

  private readonly customerAppUrl:
    string;

  private readonly adminAppUrl:
    string;

  private readonly memoryMessages:
    MemoryMail[] = [];

  constructor(
    private readonly config:
      ConfigService,
  ) {
    const configuredMode =
      this.config.getOrThrow<string>(
        'MAIL_DELIVERY_MODE',
      );

    this.mode =
      this.config.get<string>(
        'NODE_ENV',
      ) === 'test'
        ? 'memory'
        : configuredMode === 'smtp'
          ? 'smtp'
          : 'memory';

    this.from =
      this.config.getOrThrow<string>(
        'MAIL_FROM',
      );

    this.customerAppUrl =
      this.config.getOrThrow<string>(
        'CUSTOMER_APP_URL',
      );

    this.adminAppUrl =
      this.config.getOrThrow<string>(
        'ADMIN_APP_URL',
      );

    if (this.mode === 'smtp') {
      const user =
        this.config.get<string>(
          'SMTP_USER',
        );

      const password =
        this.config.get<string>(
          'SMTP_PASSWORD',
        );

      this.transporter =
        nodemailer.createTransport({
          host:
            this.config.getOrThrow<string>(
              'SMTP_HOST',
            ),
          port:
            this.config.getOrThrow<number>(
              'SMTP_PORT',
            ),
          secure:
            this.config.getOrThrow<boolean>(
              'SMTP_SECURE',
            ),
          ...(user
            ? {
                auth: {
                  user,
                  pass:
                    password ?? '',
                },
              }
            : {}),
        });
    } else {
      this.transporter = null;
    }
  }

  async sendEmailVerification(
    input: {
      email: string;
      fullName: string;
      role: AuthRole;
      token: string;
    },
  ): Promise<void> {
    const link =
      this.createFrontendLink(
        input.role,
        '/verify-email',
        input.token,
      );

    await this.send({
      kind: 'email_verification',
      email: input.email,
      token: input.token,
      subject:
        'Verify your Poromosiyo email',
      text: [
        `Hello ${input.fullName},`,
        '',
        'Verify your Poromosiyo email address using this link:',
        link,
        '',
        'If you did not request this, you can ignore this message.',
      ].join('\n'),
    });
  }

  async sendPasswordReset(
    input: {
      email: string;
      fullName: string;
      role: AuthRole;
      token: string;
    },
  ): Promise<void> {
    const link =
      this.createFrontendLink(
        input.role,
        '/reset-password',
        input.token,
      );

    await this.send({
      kind: 'password_reset',
      email: input.email,
      token: input.token,
      subject:
        'Reset your Poromosiyo password',
      text: [
        `Hello ${input.fullName},`,
        '',
        'Reset your Poromosiyo password using this link:',
        link,
        '',
        'If you did not request a password reset, you can ignore this message.',
      ].join('\n'),
    });
  }

  async sendPasswordChanged(
    input: {
      email: string;
      fullName: string;
    },
  ): Promise<void> {
    await this.send({
      kind: 'password_changed',
      email: input.email,
      token: null,
      subject:
        'Your Poromosiyo password was changed',
      text: [
        `Hello ${input.fullName},`,
        '',
        'Your Poromosiyo password was changed.',
        '',
        'If you did not make this change, contact Poromosiyo support immediately.',
      ].join('\n'),
    });
  }

  getLatestMemoryToken(
    kind:
      | 'email_verification'
      | 'password_reset',
    email: string,
  ): string | null {
    if (this.mode !== 'memory') {
      return null;
    }

    for (
      let index =
        this.memoryMessages.length - 1;
      index >= 0;
      index -= 1
    ) {
      const message =
        this.memoryMessages[index];

      if (
        message?.kind === kind &&
        message.email === email
      ) {
        return message.token;
      }
    }

    return null;
  }

  clearMemoryMessages(): void {
    this.memoryMessages.length = 0;
  }

  private async send(
    input: {
      kind: AuthMailKind;
      email: string;
      token: string | null;
      subject: string;
      text: string;
    },
  ): Promise<void> {
    if (this.mode === 'memory') {
      this.memoryMessages.push({
        kind: input.kind,
        email: input.email,
        token: input.token,
      });

      return;
    }

    if (!this.transporter) {
      throw new Error(
        'SMTP transporter is not configured.',
      );
    }

    await this.transporter.sendMail({
      from: this.from,
      to: input.email,
      subject: input.subject,
      text: input.text,
    });
  }

  private createFrontendLink(
    role: AuthRole,
    pathname: string,
    token: string,
  ): string {
    const baseUrl =
      role === 'ADMIN'
        ? this.adminAppUrl
        : this.customerAppUrl;

    const url =
      new URL(
        pathname,
        baseUrl,
      );

    url.searchParams.set(
      'token',
      token,
    );

    return url.toString();
  }
}
