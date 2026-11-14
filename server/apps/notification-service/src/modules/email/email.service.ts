import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "../../../../../packages/logger/src/index.js";

const log = logger("notification-service:email");

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
}

export interface BookingEmailData {
  to: string;
  customerName: string;
  eventTitle: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  bookingId: string;
  tickets: Array<{
    ticketCode: string;
    ticketName: string;
    ticketNumber: number;
  }>;
  totalFormatted: string;
  bookingUrl: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private from: string;

  constructor(private config: SmtpConfig) {
    this.from = config.from;
    if (config.user && config.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      log.info(`SMTP transporter initialized for ${config.user} via ${config.host}:${config.port}`);
    } else {
      log.info("SMTP credentials not provided; live email dispatch will be simulated in logs.");
    }
  }

  async sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
    const subject = `Your Tickets for ${data.eventTitle} (Ref: ${data.bookingId.slice(0, 8)})`;

    const ticketListHtml = data.tickets
      .map(
        (t) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
          <div style="font-weight: 600; color: #0f172a; font-size: 15px;">
            Pass #${t.ticketNumber} · ${t.ticketName}
          </div>
          <div style="font-family: monospace; font-size: 13px; color: #0284c7; margin-top: 4px; letter-spacing: 0.05em;">
            Code: <strong>${t.ticketCode}</strong>
          </div>
        </div>
      `,
      )
      .join("");

    const ticketListText = data.tickets
      .map((t) => `  - Pass #${t.ticketNumber}: ${t.ticketName} (Code: ${t.ticketCode})`)
      .join("\n");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 32px 16px; color: #334155;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 32px; text-align: center; border-bottom: 3px solid #38bdf8;">
              <h1 style="color: #ffffff; font-size: 24px; margin: 0; letter-spacing: -0.02em;">
                eventconn<span style="color: #38bdf8;">.</span>
              </h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 8px 0 0 0; text-transform: uppercase; letter-spacing: 0.1em;">
                Booking Confirmed
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px 0;">
                You're going to ${data.eventTitle}!
              </h2>
              <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5;">
                Hi ${data.customerName}, your reservation is confirmed. Here are your booking details and admission passes.
              </p>

              <!-- Event Card -->
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px;">
                  Event Information
                </div>
                <div style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 8px;">
                  ${data.eventTitle}
                </div>
                <div style="font-size: 14px; color: #475569; margin-bottom: 4px;">
                  📅 ${data.eventDate}
                </div>
                <div style="font-size: 14px; color: #475569;">
                  📍 ${data.venueName} · ${data.venueAddress}
                </div>
              </div>

              <!-- Tickets Section -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">
                  Your Admission Passes (${data.tickets.length})
                </div>
                ${ticketListHtml}
                <p style="font-size: 12px; color: #94a3b8; margin: 8px 0 0 0;">
                  Show the QR codes on your mobile phone upon entrance for admission.
                </p>
              </div>

              <!-- Summary Line -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 28px; display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-size: 15px;">Total Paid:</span>
                <span style="font-size: 18px; font-weight: 700; color: #0f172a;">${data.totalFormatted}</span>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${data.bookingUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                  View QR Passes & Booking
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                EventConn · Booking ID: ${data.bookingId}<br />
                Need assistance? Reply directly to this email or visit your account portal.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const text = `
EventConn - Booking Confirmed!
==============================
Hi ${data.customerName},

Your reservation for "${data.eventTitle}" is confirmed!

Booking Reference: ${data.bookingId}
Date & Time: ${data.eventDate}
Venue: ${data.venueName} (${data.venueAddress})

Your Tickets:
${ticketListText}

Total Paid: ${data.totalFormatted}

Access your digital passes and QR codes here:
${data.bookingUrl}

Thank you for booking with EventConn!
    `.trim();

    if (!this.transporter) {
      log.info(
        `[SIMULATED EMAIL] To: ${data.to} | Subject: "${subject}" | Passes: ${data.tickets.length} | Total: ${data.totalFormatted}`,
      );
      return true;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: data.to,
        subject,
        text,
        html,
      });
      log.info(`Email successfully dispatched to ${data.to} (MessageId: ${info.messageId})`);
      return true;
    } catch (err) {
      log.error(`Failed to send email to ${data.to}: ${(err as Error).message}`);
      return false;
    }
  }
}
