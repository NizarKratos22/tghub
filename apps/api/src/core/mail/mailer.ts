import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  /** True when mail actually leaves the server (false = development log). */
  readonly delivers: boolean;
  send(message: MailMessage): Promise<void>;
}

/** Production: any SMTP provider (Brevo, Mailgun, SES, Postmark…) via SMTP_URL. */
class SmtpMailer implements Mailer {
  readonly delivers = true;
  private readonly transport = nodemailer.createTransport(env.SMTP_URL);

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

/** No SMTP_URL (development, or production before email is set up): the email lands in the API log instead of an inbox. */
class LogMailer implements Mailer {
  readonly delivers = false;

  async send(message: MailMessage): Promise<void> {
    logger.info({ to: message.to, subject: message.subject }, `[dev mail] ${message.text}`);
  }
}

export const mailer: Mailer = env.SMTP_URL ? new SmtpMailer() : new LogMailer();
