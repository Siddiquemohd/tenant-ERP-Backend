import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateTOTPSecret(email: string, companyName: string = 'TenantERP') {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${companyName}:${email}`,
    issuer: companyName,
  });

  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

export async function generateQRCodeDataURL(otpauthUrl: string): Promise<string> {
  return await QRCode.toDataURL(otpauthUrl);
}

export function verifyTOTPCode(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 30s clock skew tolerance
  });
}
