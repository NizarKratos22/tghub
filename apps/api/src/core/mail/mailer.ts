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

/** Below Gmail's ~500 messages a day for a personal account, so the account itself never gets locked. */
const DAILY_BUDGET = 400;

/** Production: any SMTP provider (Gmail, Brevo, Mailgun, SES…) via SMTP_URL. */
class SmtpMailer implements Mailer {
  readonly delivers = true;
  // A small pool reuses the login (bursts of logins trigger Gmail's throttling); short timeouts keep requests from hanging.
  private readonly transport = nodemailer.createTransport({
    url: env.SMTP_URL,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  private budgetDay = '';
  private sentToday = 0;

  constructor() {
    this.transport.verify().then(
      () => logger.info('SMTP login ok'),
      (error: unknown) => logger.error({ err: error }, 'SMTP login failed: check SMTP_URL (and the Gmail app password)'),
    );
  }

  async send(message: MailMessage): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.budgetDay) {
      this.budgetDay = today;
      this.sentToday = 0;
    }
    if (this.sentToday >= DAILY_BUDGET) {
      logger.error({ sentToday: this.sentToday }, 'Daily email budget reached; not sending');
      throw new Error('Daily email budget reached');
    }
    this.sentToday += 1;
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
