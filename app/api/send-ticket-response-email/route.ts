import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ticketId,
      userEmail,
      userName,
      ticketSubject,
      adminResponse,
      ticketUrl,
    } = body;

    // Validate required fields
    if (
      !ticketId ||
      !userEmail ||
      !userName ||
      !ticketSubject ||
      !adminResponse ||
      !ticketUrl
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "Pocket Dev Support <onboarding@resend.dev>", // Use Resend's test domain for development
      to: [userEmail],
      subject: `Re: ${ticketSubject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Support Ticket Response</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #ffffff;">Pocket Dev</h1>
                <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Build apps with AI</p>
              </div>

              <!-- Main Content -->
              <div style="background: linear-gradient(to bottom right, #1e293b, #0f172a); border: 1px solid rgba(71, 85, 105, 0.4); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
                <p style="margin: 0 0 24px; font-size: 16px; color: #e2e8f0;">Hi ${userName},</p>

                <p style="margin: 0 0 24px; font-size: 14px; color: #cbd5e1;">We've responded to your support ticket:</p>

                <!-- Ticket Info -->
                <div style="background-color: rgba(15, 23, 42, 0.6); border: 1px solid rgba(71, 85, 105, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Ticket Subject</p>
                  <p style="margin: 0 0 16px; font-size: 14px; font-weight: 500; color: #f1f5f9;">${ticketSubject}</p>

                  <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Admin Response</p>
                  <p style="margin: 0; font-size: 14px; color: #e2e8f0; white-space: pre-wrap;">${adminResponse}</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(to right, #2563eb, #7c3aed); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);">
                    View Ticket in Dashboard
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="text-align: center; padding-top: 24px; border-top: 1px solid rgba(71, 85, 105, 0.3);">
                <p style="margin: 0; font-size: 12px; color: #64748b;">This is an automated message. Please do not reply to this email.</p>
                <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">To respond, please visit your dashboard and reply to the ticket.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend email error:", error);
      return NextResponse.json(
        { error: "Failed to send email", details: error },
        { status: 500 }
      );
    }

    console.log("Email sent successfully:", data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
