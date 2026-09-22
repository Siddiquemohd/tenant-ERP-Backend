import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/userModel';
import { CompanyModel } from '../models/companyModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { generateTOTPSecret, generateQRCodeDataURL, verifyTOTPCode } from '../utils/totp';

const JWT_SECRET = process.env.JWT_SECRET || 'tenant_erp_super_secret_jwt_key_2026';

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.company) {
      return res.status(400).json({ error: 'User is not associated with any valid tenant company' });
    }

    // Check if user has an existing 2FA secret or needs first-time 2FA setup
    if (!user.twoFactorSecret || user.twoFactorSecret.trim() === '') {
      // First-time 2FA Setup: Generate secret and QR code
      const companyName = user.company?.name || 'TenantERP';
      const { base32, otpauthUrl } = generateTOTPSecret(user.email, companyName);
      const qrCodeUrl = await generateQRCodeDataURL(otpauthUrl!);

      const tempToken = jwt.sign(
        { userId: user.id, isTemp2FA: true, isFirstTime2FA: true, tempSecret: base32 },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        requires2FA: true,
        isFirstTime2FA: true,
        tempToken,
        qrCodeUrl,
        secret: base32,
        message: 'First time login: Scan QR Code or enter Secret Key in Google Authenticator app',
      });
    }

    // Existing 2FA User: Require TOTP verification (no QR code shown)
    const tempToken = jwt.sign(
      { userId: user.id, isTemp2FA: true, isFirstTime2FA: false },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({
      requires2FA: true,
      isFirstTime2FA: false,
      tempToken,
      message: 'Google Authenticator 2FA TOTP code required',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function verify2FALogin(req: Request, res: Response) {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ error: 'Temporary token and 6-digit TOTP code are required' });
    }

    const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
    if (!decoded || !decoded.userId || !decoded.isTemp2FA) {
      return res.status(401).json({ error: 'Invalid or expired 2FA session' });
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let secretToVerify = '';
    if (decoded.isFirstTime2FA) {
      secretToVerify = decoded.tempSecret;
    } else {
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: '2FA secret not configured for this user' });
      }
      secretToVerify = user.twoFactorSecret;
    }

    const isValid = verifyTOTPCode(secretToVerify, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit Google Authenticator code. Please try again.' });
    }

    // If first time 2FA setup, persist secret and set twoFactorEnabled = true
    if (decoded.isFirstTime2FA) {
      await UserModel.update2FASecret(user.id, decoded.tempSecret);
      await UserModel.set2FAEnabled(user.id, true);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const updatedUser = decoded.isFirstTime2FA ? await UserModel.findById(user.id) : user;
    const { passwordHash, twoFactorSecret, ...userWithoutPassword } = updatedUser || user;

    res.json({
      token,
      user: userWithoutPassword,
      company: user.company,
    });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired 2FA code verification' });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { companyName, name, email, password, currency } = req.body;

    if (!companyName || !name || !email || !password) {
      return res.status(400).json({ error: 'Company Name, User Name, Email, and Password are required' });
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    // 1. Create Tenant Company
    const company = await CompanyModel.create({
      name: companyName,
      currency: currency || 'USD',
    });

    // 2. Hash Password & Create User
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      companyId: company.id,
      name,
      email,
      passwordHash,
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { passwordHash: _, twoFactorSecret: __, ...userWithoutPassword } = user;

    res.status(201).json({
      token,
      user: userWithoutPassword,
      company,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { passwordHash, twoFactorSecret, ...userWithoutPassword } = req.user;
    
    let activeCompany = req.user.company;
    if (req.tenantId && req.tenantId !== req.user.companyId) {
      const company = await CompanyModel.findById(req.tenantId);
      if (company) {
        activeCompany = company;
      }
    }

    res.json({
      user: userWithoutPassword,
      company: activeCompany,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function setup2FA(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const companyName = req.user.company?.name || 'TenantERP';
    const { base32, otpauthUrl } = generateTOTPSecret(req.user.email, companyName);

    // Save temporary secret to user record
    await UserModel.update2FASecret(req.user.id, base32);

    const qrCodeUrl = await generateQRCodeDataURL(otpauthUrl!);

    res.json({
      secret: base32,
      qrCodeUrl,
      otpauthUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function enable2FA(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { code } = req.body;

    const user = await UserModel.findById(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Please generate 2FA QR code first' });
    }

    const isValid = verifyTOTPCode(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit TOTP verification code' });
    }

    await UserModel.set2FAEnabled(req.user.id, true);

    res.json({ success: true, message: 'Google Authenticator 2FA enabled successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function disable2FA(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const { code } = req.body;

    const user = await UserModel.findById(req.user.id);
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    const isValid = verifyTOTPCode(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid 6-digit TOTP verification code' });
    }

    await UserModel.set2FAEnabled(req.user.id, false);

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
