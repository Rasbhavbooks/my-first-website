import { createHash, randomBytes } from "node:crypto";
import User from "../users/user.model.js";
import VerificationToken from "./verification-token.model.js";

const VERIFICATION_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function invalidInput(response) {
  return response.status(400).json({
    error: {
      code: "INVALID_REGISTRATION",
      message: "Enter a valid name, email, and password. Passwords need at least 12 characters, including an uppercase letter, a lowercase letter, and a number.",
    },
  });
}

function safeUser(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

export async function registerReader(request, response) {
  if (process.env.NODE_ENV === "production") {
    return response.status(503).json({
      error: {
        code: "EMAIL_DELIVERY_NOT_CONFIGURED",
        message: "Registration is temporarily unavailable until email verification is configured.",
      },
    });
  }

  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidInput(response);

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const validEmail = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPassword = password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);

  if (displayName.length < 2 || displayName.length > 80 || !validEmail || !validPassword) {
    return invalidInput(response);
  }

  if (await User.exists({ email })) {
    return response.status(409).json({
      error: { code: "ACCOUNT_EXISTS", message: "An account with this email already exists." },
    });
  }

  const user = new User({ displayName, email });
  await user.setPassword(password);

  try {
    await user.save();
    const token = randomBytes(32).toString("base64url");
    const verificationToken = new VerificationToken({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    });

    try {
      await verificationToken.save();
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    return response.status(201).json({
      data: {
        message: "Reader account created. Verify the email to activate it.",
        user: safeUser(user),
        verificationToken: token,
        verificationExpiresAt: verificationToken.expiresAt,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({
        error: { code: "ACCOUNT_EXISTS", message: "An account with this email already exists." },
      });
    }
    throw error;
  }
}

export async function verifyReaderEmail(request, response) {
  const token = typeof request.body?.token === "string" ? request.body.token : "";
  if (token.length < 32 || token.length > 100) {
    return response.status(400).json({
      error: { code: "INVALID_VERIFICATION_TOKEN", message: "Verification token is invalid or expired." },
    });
  }

  const verificationToken = await VerificationToken.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });

  if (!verificationToken) {
    return response.status(400).json({
      error: { code: "INVALID_VERIFICATION_TOKEN", message: "Verification token is invalid or expired." },
    });
  }

  const user = await User.findById(verificationToken.userId);
  if (!user || user.accountStatus !== "pending_verification") {
    await VerificationToken.deleteOne({ _id: verificationToken._id });
    return response.status(400).json({
      error: { code: "INVALID_VERIFICATION_TOKEN", message: "Verification token is invalid or expired." },
    });
  }

  user.accountStatus = "active";
  user.emailVerifiedAt = new Date();
  await user.save();
  await VerificationToken.deleteOne({ _id: verificationToken._id });

  return response.json({
    data: { message: "Email verified. Your reader account is active." },
  });
}
