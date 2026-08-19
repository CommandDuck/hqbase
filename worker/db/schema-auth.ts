import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deviceCodes = sqliteTable("deviceCode", {
  id: text("id").primaryKey().notNull(),
  deviceCode: text("deviceCode").notNull().unique(),
  userCode: text("userCode").notNull().unique(),
  userId: text("userId"),
  expiresAt: text("expiresAt").notNull(),
  status: text("status", { enum: ["pending", "approved", "denied"] }).notNull(),
  lastPolledAt: text("lastPolledAt"),
  pollingInterval: integer("pollingInterval"),
  clientId: text("clientId"),
  scope: text("scope"),
  resources: text("resources"),
  oauthClientId: text("oauthClientId"),
  sessionId: text("sessionId")
});

export const oauthAccessTokens = sqliteTable("oauthAccessToken", {
  id: text("id").primaryKey().notNull(),
  token: text("token").notNull().unique(),
  clientId: text("clientId").notNull(),
  sessionId: text("sessionId"),
  userId: text("userId"),
  referenceId: text("referenceId"),
  refreshId: text("refreshId"),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  scopes: text("scopes").notNull(),
  authorizationCodeId: text("authorizationCodeId"),
  resources: text("resources"),
  requestedUserInfoClaims: text("requestedUserInfoClaims"),
  revoked: text("revoked"),
  confirmation: text("confirmation")
});

export const oauthRefreshTokens = sqliteTable("oauthRefreshToken", {
  id: text("id").primaryKey().notNull(),
  token: text("token").notNull().unique(),
  clientId: text("clientId").notNull(),
  sessionId: text("sessionId"),
  userId: text("userId").notNull(),
  referenceId: text("referenceId"),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(),
  revoked: text("revoked"),
  authTime: text("authTime"),
  scopes: text("scopes").notNull(),
  authorizationCodeId: text("authorizationCodeId"),
  resources: text("resources"),
  requestedUserInfoClaims: text("requestedUserInfoClaims"),
  rotatedAt: text("rotatedAt"),
  rotationReplayResponse: text("rotationReplayResponse"),
  rotationReplayExpiresAt: text("rotationReplayExpiresAt"),
  confirmation: text("confirmation")
});

export const oauthConsents = sqliteTable("oauthConsent", {
  id: text("id").primaryKey().notNull(),
  clientId: text("clientId").notNull(),
  userId: text("userId"),
  referenceId: text("referenceId"),
  scopes: text("scopes").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
  resources: text("resources"),
  requestedUserInfoClaims: text("requestedUserInfoClaims")
});
