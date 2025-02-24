import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

export async function send2FAVerificationEmail(
  toEmail: string,
  verificationCode: string
): Promise<boolean> {
  try {
    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: "Your Two-Factor Authentication Code",
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: `Your verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.`,
            Charset: "UTF-8",
          },
          Html: {
            Data: `
              <div>
                <h2>Your Two-Factor Authentication Code</h2>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request this code, please ignore this email.</p>
              </div>
            `,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(command);
    return true;
  } catch (error) {
    console.error('AWS SES email error:', error);
    return false;
  }
}