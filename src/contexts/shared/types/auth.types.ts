/**
 * Types for authentication and JWT
 */

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** User unique identifier */
  sub: string | number;
  /** User email address */
  email: string;
  /** User role (optional) */
  role?: string;
  /** Token creation timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
  /** Additional custom claims */
  [key: string]: unknown;
}

/**
 * User object from LocalStrategy
 */
export interface AuthUser {
  id: string | number;
  email: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Token response structure
 */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
}

/**
 * Refresh token request/response structure
 */
export interface RefreshTokenResponse {
  accessToken?: string;
  refreshToken?: string;
  success?: boolean;
  error?: string;
}

/**
 * Login request with user data (from LocalStrategy)
 */
export interface LoginRequest {
  user: AuthUser;
}

/**
 * Login DTO from request body
 */
export interface LoginRequestBody {
  email: string;
  password: string;
}
