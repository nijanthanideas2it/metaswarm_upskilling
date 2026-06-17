import * as nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { IEmailService } from '../../application/ports/email.port';

export class NodemailerEmailService implements IEmailService {
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    // Guard: skip creating transporter when SMTP_HOST is not configured (test/dev without SMTP)
    if (!env.SMTP_HOST) {
      this.transporter = null;
    } else {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (this.transporter === null) {
      return;
    }

    await this.transporter.sendMail({
      to,
      subject: 'Reset your password',
      text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    });
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    if (this.transporter === null) {
      return;
    }

    await this.transporter.sendMail({
      to,
      subject: 'Your password has been changed',
      text: 'This is a confirmation that the password for your account has been successfully changed. If you did not make this change, please contact support immediately.',
    });
  }
}
