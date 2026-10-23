declare module "nodemailer" {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    tls?: { rejectUnauthorized?: boolean };
    auth?: { user: string; pass: string };
  }

  interface Transporter {
    verify(): Promise<void>;
    sendMail(options: {
      from?: string;
      to: string;
      replyTo?: string;
      subject: string;
      text?: string;
      html?: string;
      attachments?: Array<{
        filename?: string;
        content?: Buffer | string;
        contentType?: string;
      }>;
    }): Promise<{ messageId: string }>;
  }

  function createTransport(options?: TransportOptions): Transporter;

  const nodemailer: { createTransport: typeof createTransport };
  export = nodemailer;
}
