import { createHash, randomBytes } from "node:crypto";
import User from "../users/user.model.js";
import VerificationToken from "./verification-token.model.js";
import ReaderSession from "./reader-session.model.js";

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
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    hobbies: Array.isArray(user.hobbies) ? user.hobbies : [],
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


const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = "rasbhav_reader_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function readSessionCookie(request) {
  const cookies = request.headers.cookie || "";
  const entry = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? entry.slice(SESSION_COOKIE.length + 1) : "";
}

export async function loginReader(request, response) {
  const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!email || email.length > 254 || !password || password.length > 128) {
    return response.status(400).json({
      error: { code: "INVALID_CREDENTIALS", message: "Enter a valid email and password." },
    });
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  const passwordMatches = user ? await user.verifyPassword(password) : false;
  if (!user || !passwordMatches) {
    return response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
    });
  }
  if (user.accountStatus !== "active") {
    return response.status(403).json({
      error: { code: user.accountStatus === "pending_verification" ? "EMAIL_NOT_VERIFIED" : "ACCOUNT_UNAVAILABLE",
        message: user.accountStatus === "pending_verification" ? "Verify your email before signing in." : "This account is unavailable." },
    });
  }

  const existingToken = readSessionCookie(request);
  if (existingToken) await ReaderSession.deleteOne({ tokenHash: hashToken(existingToken) });

  const token = randomBytes(32).toString("base64url");
  const session = new ReaderSession({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  await session.save();
  response.setHeader("Cache-Control", "no-store");
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  return response.json({ data: { user: safeUser(user), expiresAt: session.expiresAt } });
}

export async function getReaderSession(request, response) {
  const token = readSessionCookie(request);
  if (!token) {
    return response.status(401).json({ error: { code: "NOT_AUTHENTICATED", message: "Sign in to continue." } });
  }

  const session = await ReaderSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).populate("userId");
  if (!session || !session.userId || session.userId.accountStatus !== "active") {
    if (session) await ReaderSession.deleteOne({ _id: session._id });
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return response.status(401).json({ error: { code: "NOT_AUTHENTICATED", message: "Sign in to continue." } });
  }

  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { user: safeUser(session.userId), expiresAt: session.expiresAt } });
}

export async function logoutReader(request, response) {
  const token = readSessionCookie(request);
  if (token) await ReaderSession.deleteOne({ tokenHash: hashToken(token) });
  response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { message: "Signed out." } });
}


export function getReaderProfile(request, response) {
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { user: safeUser(request.reader) } });
}

export async function updateReaderProfile(request, response) {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
  const displayName = body.displayName === undefined
    ? request.reader.displayName
    : typeof body.displayName === "string" ? body.displayName.trim() : "";
  const bio = body.bio === undefined
    ? request.reader.bio || ""
    : typeof body.bio === "string" ? body.bio.trim() : null;
  const rawHobbies = body.hobbies === undefined ? request.reader.hobbies || [] : body.hobbies;
  const avatarUrl = body.avatarUrl === undefined
    ? request.reader.avatarUrl || ""
    : typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : null;

  const validHobbies = Array.isArray(rawHobbies)
    && rawHobbies.length <= 10
    && rawHobbies.every((item) => typeof item === "string" && item.trim().length >= 1 && item.trim().length <= 40);
  let validAvatarUrl = avatarUrl === "";
  if (typeof avatarUrl === "string" && avatarUrl.length <= 500 && avatarUrl) {
    try {
      validAvatarUrl = new URL(avatarUrl).protocol === "https:";
    } catch {
      validAvatarUrl = false;
    }
  }

  if (
    displayName.length < 2 || displayName.length > 80
    || typeof bio !== "string" || bio.length > 280
    || !validHobbies
    || typeof avatarUrl !== "string" || !validAvatarUrl
  ) {
    return response.status(400).json({
      error: { code: "INVALID_PROFILE", message: "Check your name, bio, hobbies, and HTTPS profile photo link." },
    });
  }

  const uniqueHobbies = [...new Map(rawHobbies.map((item) => [item.trim().toLowerCase(), item.trim()])).values()];
  request.reader.displayName = displayName;
  request.reader.bio = bio;
  request.reader.hobbies = uniqueHobbies;
  request.reader.avatarUrl = avatarUrl;
  await request.reader.save();
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { user: safeUser(request.reader) } });
}

export async function changeReaderPassword(request, response) {
  const currentPassword = typeof request.body?.currentPassword === "string" ? request.body.currentPassword : "";
  const newPassword = typeof request.body?.newPassword === "string" ? request.body.newPassword : "";
  const validPassword = newPassword.length >= 12
    && newPassword.length <= 128
    && /[a-z]/.test(newPassword)
    && /[A-Z]/.test(newPassword)
    && /\d/.test(newPassword);

  if (!currentPassword || !validPassword) {
    return response.status(400).json({
      error: { code: "INVALID_PASSWORD", message: "Enter your current password and a new password with at least 12 characters, including uppercase, lowercase, and a number." },
    });
  }

  const user = await User.findById(request.reader._id).select("+passwordHash");
  if (!user || !(await user.verifyPassword(currentPassword))) {
    return response.status(400).json({
      error: { code: "CURRENT_PASSWORD_INCORRECT", message: "Current password is incorrect." },
    });
  }

  await user.setPassword(newPassword);
  await user.save();
  await ReaderSession.deleteMany({ userId: user._id });
  response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  response.setHeader("Cache-Control", "no-store");
  return response.json({ data: { message: "Password changed. Sign in again on this device." } });
}
