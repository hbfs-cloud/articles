# PRD-18: Security & Access Control

**Version**: 1.0  
**Status**: Draft  
**Dependencies**: PRD-10 (API Layer), PRD-14 (User Management), PRD-07 (Broker Adapters), PRD-12 (MCP Orchestration)

---

## 1. Overview

This PRD defines the complete security architecture for the DailyTickers AutoTrader SaaS platform. It covers JWT authentication, API key management, rate limiting, broker credential encryption, multi-tenant data isolation, MCP gateway protection, and infrastructure hardening. Every implementation detail is specified to be unambiguous.

---

## 2. Authentication

### 2.1 JWT Access Tokens

**Algorithm**: RS256 (asymmetric — private key signs, public key verifies)  
**TTL**: 15 minutes  
**Transport**: `Authorization: Bearer <token>` header only (never cookies, never query params)

**Payload schema** (exact fields, no additions):
```typescript
interface JWTPayload {
  // Standard claims
  iss: string;          // "https://api.dailytickers.com"
  sub: string;          // user UUID
  aud: string;          // "dailytickers-api"
  iat: number;          // issued-at (Unix seconds)
  exp: number;          // iat + 900 (15 min)
  jti: string;          // UUID v4, unique per token (for revocation)

  // Custom claims
  user_id: string;      // same as sub, explicit
  email: string;        // user email
  role: Role;           // single role per user
  tier: Tier;           // subscription tier (derived from role for member-* roles)
}

type Role = "admin" | "operator" | "monitor" | "member-free" | "member-basic" | "member-pro" | "member-team" | "member-elite";
type Tier = "free" | "basic" | "pro" | "team" | "elite";
```

**Key rotation**: RS256 key pair rotated every 90 days. Old public key kept for 15 min overlap to allow in-flight tokens to validate. Key ID (`kid`) in JWT header identifies which key to use.

**Signing key storage**: Private key in HashiCorp Vault (path: `secret/jwt/signing_key`). Never in DB or env vars. Loaded at service startup into memory-only.

**Validation middleware** (applied to every protected endpoint):
```
1. Extract Bearer token from Authorization header
2. Decode header, read kid
3. Fetch public key for kid from in-memory key store (never network call in hot path)
4. Verify RS256 signature
5. Verify exp > now, iss == "https://api.dailytickers.com", aud == "dailytickers-api"
6. Check jti not in revocation set (in-memory sync.Map with TTL = token remaining lifetime; evicted by background goroutine)
7. Load user record from DB or in-memory cache (sync.Map, TTL 5 min)
8. Attach user to request context
9. Proceed or return 401
```

**Failure responses** (always `WWW-Authenticate: Bearer realm="dailytickers"` header):
```
401 { "error": "token_expired", "message": "Access token expired. Refresh required." }
401 { "error": "token_invalid", "message": "Token signature invalid." }
401 { "error": "token_revoked", "message": "Token has been revoked." }
401 { "error": "token_missing", "message": "Authorization header required." }
```

### 2.2 Refresh Tokens

**TTL**: 7 days  
**Storage**: DB table `refresh_tokens` (hashed with SHA-256 before storage — raw token never stored)  
**Rotation**: Every use generates a new refresh token. Old token immediately invalidated.  
**Transport**: `POST /api/v1/auth/refresh` with `{"refresh_token": "<token>"}` in JSON body. Never in URL.

**Endpoint**: `POST /api/v1/auth/refresh`
```typescript
// Request
{ "refresh_token": string }

// Response 200
{
  "access_token": string,    // new JWT (15 min TTL)
  "refresh_token": string,   // new refresh token (7 day TTL, old one invalid)
  "expires_in": 900          // access token lifetime in seconds
}

// Response 401
{ "error": "refresh_token_invalid" | "refresh_token_expired" | "refresh_token_used" }
```

**Refresh token DB schema**:
```sql
CREATE TABLE refresh_tokens (
  id         VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id    VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR2(64) NOT NULL UNIQUE,    -- SHA-256(raw_token), hex-encoded
  created_at TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP,
  expires_at TIMESTAMP NOT NULL,              -- created_at + 7 days
  used_at    TIMESTAMP,                       -- set on first use (detect reuse attacks)
  revoked_at TIMESTAMP,
  user_agent VARCHAR2(500),
  ip_address VARCHAR2(45)                     -- IPv4 or IPv6
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

**Token reuse detection**: If a token is used after `used_at` is set → revoke ALL refresh tokens for that user (session hijacking assumed), return 401 `refresh_token_used`.

### 2.3 Login Endpoint

**Endpoint**: `POST /api/v1/auth/login`
```typescript
// Request
{ "email": string, "password": string }

// Response 200
{
  "access_token": string,
  "refresh_token": string,
  "expires_in": 900,
  "user": { "id": string, "email": string, "tier": string, "roles": string[] }
}

// Response 401
{ "error": "invalid_credentials" }  // same message for wrong email AND wrong password (no enumeration)

// Response 429
{ "error": "too_many_attempts", "retry_after_seconds": number }
```

**Brute-force protection**: Sliding window rate limit on login attempts:
- Per email: 10 attempts per 15 min window. After 10 failures: 15 min lockout.
- Per IP: 30 attempts per 15 min window. After 30 failures: 60 min lockout.
- Lockout state stored in-memory (sync.Map with expiry goroutine). At ~25 users this is sufficient; no Redis needed for auth lockout.

**Password storage**: bcrypt with cost factor 12. Never store plaintext or MD5/SHA hashes.

### 2.4 Logout

**Endpoint**: `POST /api/v1/auth/logout`
```typescript
// Request (authenticated)
{ "refresh_token"?: string }  // optional: revoke specific refresh token

// Behavior
// 1. Add access token jti to in-memory revocation set (sync.Map, TTL = remaining lifetime)
// 2. If refresh_token provided: set revoked_at in DB
// 3. Return 204 No Content
```

---

## 3. API Keys

For programmatic access (pipelines, bots, CI integrations).

### 3.1 Key Structure

**Format**: `dt_live_<base62(32 bytes)>` for production, `dt_test_<base62(32 bytes)>` for sandbox.  
**Generation**: `crypto.randomBytes(32)` → base62 encode → prepend prefix.  
**Storage**: Only the SHA-256 hash of the full key is stored in DB. Raw key shown once on creation.  
**Prefix stored separately**: `dt_live_` prefix enables prefix-based lookups without storing raw key.

```sql
CREATE TABLE api_keys (
  id               VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id          VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR2(100) NOT NULL,              -- human label
  key_prefix       VARCHAR2(12) NOT NULL,               -- first 12 chars for display: "dt_live_xxxx"
  key_hash         VARCHAR2(64) NOT NULL UNIQUE,        -- SHA-256(full_key), hex
  scopes           JSON NOT NULL,                       -- JSON array, see §3.2
  tier_at_creation VARCHAR2(20) NOT NULL,               -- snapshot of user tier
  created_at       TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP,
  last_used_at     TIMESTAMP,
  expires_at       TIMESTAMP,                           -- null = no expiry
  revoked_at       TIMESTAMP,
  ip_whitelist     JSON,                                -- JSON array of IP strings, null = allow any
  description      VARCHAR2(500)
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### 3.2 Scopes

```
read:signals       -- read scanner output, positions, equity
read:portfolio     -- read portfolio state, history
write:orders       -- place/cancel orders via broker adapter
write:config       -- update mode config
read:analytics     -- access backtests, strategy lab
write:analytics    -- run new backtests, optimizations
admin:*            -- all scopes (admin role only)
```

### 3.3 API Key Authentication

```
1. Request includes: X-API-Key: dt_live_xxxxx... header
2. Compute SHA-256(header value)
3. SELECT * FROM api_keys WHERE key_hash = computed_hash AND revoked_at IS NULL
4. Check expires_at (if set) > now
5. Check ip_whitelist: if not null, request IP must be in list
6. Check required scope for endpoint
7. Update last_used_at (async, non-blocking)
8. Build request context from api_keys.user_id + api_keys.scopes
```

### 3.4 Key Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/api-keys` | Create key (returns raw key once) |
| GET | `/api/v1/auth/api-keys` | List keys (prefix + metadata only) |
| DELETE | `/api/v1/auth/api-keys/{id}` | Revoke key |
| PATCH | `/api/v1/auth/api-keys/{id}` | Update name/description/ip_whitelist |

**Create response** (raw key shown exactly once):
```typescript
{
  "id": string,
  "key": "dt_live_...",     // ONLY time raw key is returned
  "key_prefix": "dt_live_xxxx",
  "scopes": string[],
  "created_at": string
}
```

---

## 4. Rate Limiting

> **Scale note**: ~25 users. Single generous limit for all authenticated users; no per-tier differentiation needed. In-memory rate limiter — no Redis dependency for rate limiting.

### 4.1 Limits

| Scope | Requests/min |
|-------|-------------|
| anonymous (by IP) | 20 |
| authenticated (any plan) | 10,000 |
| admin | unlimited |

### 4.2 In-Memory Implementation

**Algorithm**: Token bucket via `golang.org/x/time/rate`. One limiter per `user_id` stored in a sync.Map; evicted after 10 min of inactivity.

```go
var limiters sync.Map // user_id → *rate.Limiter

func getLimiter(userID string) *rate.Limiter {
    v, ok := limiters.Load(userID)
    if !ok {
        l := rate.NewLimiter(rate.Every(time.Minute/10000), 500) // 10K/min, burst 500
        limiters.Store(userID, l)
        return l
    }
    return v.(*rate.Limiter)
}
```

**Response headers on every request**:
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <Unix timestamp when bucket refills>
```

### 4.3 Endpoint-Specific Limits (layered on top of tier limits)

| Endpoint | Extra Limit | Window |
|----------|-------------|--------|
| `POST /auth/login` | 10/IP + 10/email | 15 min |
| `POST /auth/refresh` | 60 | 1 min |
| `POST /strategy/optimize` (full) | 2/user | 24h |
| `POST /strategy/backtest` | 30/user | 1h |
| Broker order endpoints | 20 | 1 min |

### 4.4 Request Signing for Broker Orders

All `POST /api/v1/orders/*` requests (place, cancel, modify) require an HMAC-SHA256 signature in addition to JWT/API-key auth.

**Signing algorithm**:
```
timestamp = Unix seconds (must be within ±30s of server time)
nonce = UUID v4
method = uppercase HTTP method ("POST")
path = URL path + query string (e.g., "/api/v1/orders/place")
body_hash = hex(SHA-256(JSON.stringify(sorted_keys(body))))

message = timestamp + "\n" + nonce + "\n" + method + "\n" + path + "\n" + body_hash

signature = hex(HMAC-SHA256(message, user_signing_secret))
```

**Request headers**:
```
X-Timestamp: <timestamp>
X-Nonce: <nonce>
X-Signature: <signature>
```

**Server validation**:
```
1. Check |server_time - X-Timestamp| <= 30 seconds → 401 if out of window
2. Check nonce not in in-memory nonce set (replay attack) → 401 if present
3. ADD nonce to in-memory set with TTL 120s (background goroutine evicts expired entries)
4. Reconstruct message using request data
5. Compute expected signature using stored user_signing_secret
6. Compare signatures using constant-time comparison (timing attack prevention)
7. Proceed or return 401 { "error": "invalid_signature" }
```

**User signing secret**: Generated on user account creation, stored encrypted in DB (see §6 encryption), rotatable via `POST /api/v1/auth/signing-secret/rotate`.

---

## 5. CORS Policy

**Allowed origins** (exact match only, no wildcards except subdomain pattern):
```
https://articles.dailytickers.com
https://dailytickers.com
https://*.dailytickers.com       -- subdomain wildcard (explicit list preferred)
```

**User-configured origins** (pro tier): stored in `user_settings.allowed_origins TEXT[]`. Validated as HTTPS URLs only. Max 5 per user.

**CORS headers returned** (only when Origin matches):
```
Access-Control-Allow-Origin: <matched_origin>   -- never "*"
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-API-Key, X-Timestamp, X-Nonce, X-Signature
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
Vary: Origin
```

**Preflight**: OPTIONS requests return 204, no body.

---

## 6. Input Validation

**Rule**: Every endpoint validates input against a JSON schema BEFORE processing. Reject with 422 on any violation.

**Common validations**:
```
- String fields: trim whitespace, max length enforced (name: 100, description: 500, etc.)
- Enum fields: exact match against allowed values (case-sensitive)
- Number fields: isFinite check, range check against allowed values
- Date fields: ISO-8601 format regex + Date.parse validity
- UUID fields: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
- Array fields: max length enforced per field spec
- JSON TEXT fields: max byte size 64KB
```

**SQL injection prevention**: Parameterized queries everywhere. No string concatenation in SQL. Use prepared statements or ORM with parameter binding. Schema: all user input goes through `$1`, `$2`... never interpolated.

**XSS prevention**:
- All string output from DB HTML-entity-encoded when rendered in HTML context
- `Content-Security-Policy` header on all HTML responses (see §9)
- API JSON responses: `Content-Type: application/json` always set
- No `innerHTML` assignments with user-controlled data in frontend

---

## 7. MCP Gateway Security

### 7.1 Server-Side Only

`MCP_GATEWAY_URL` is an environment variable available only to server-side processes. Rules:
- Never included in API responses
- Never logged at DEBUG level or above in request/response logs
- Never passed to client-side code or WebSocket messages
- Frontend calls `/api/v1/market/*` endpoints which proxy to MCP internally

### 7.2 Per-User MCP Rate Limits

MCP calls are pooled and attributed per user. Budget tracked in-memory (sync.Map with daily reset).

```
Key: {user_id}:{tool_name}:{YYYY-MM-DD}
Value: count of calls today

On each MCP call for a user:
  1. Increment in-memory counter
  2. Check against daily budget (see table below)
  3. If over budget: return cached result (stale acceptable) or 429

Daily MCP budgets per tier:
  free:          0 direct MCP calls (all data from shared cache only)
  basic:       500 calls/day total
  pro:       5,000 calls/day total
  team:     10,000 calls/day total (shared across team seats)
  elite:    50,000 calls/day total
  admin:  unlimited
  operator: unlimited
  monitor:  unlimited (read-only)
```

**Shared calls**: MCP calls for market-wide data (GetMarketOverview, GetRegimeProbability, correlation matrix) are made ONCE and cached in-memory. Attribution: amortized across all active users (count as 1/N calls per user where N = active users in last hour). Minimum attribution: 0.01 calls.

### 7.3 MCP Response Caching (shared)

See PRD-19 for full cache architecture. Security note: shared cache keys must never include user-specific data. In-memory cache key schema: `shared:{tool_name}:{params_hash}`.

`params_hash = hex(SHA-256(JSON.stringify(sorted_keys(params))))` — deterministic regardless of field order.

### 7.4 Audit Logging for MCP Calls

Every MCP call logged to `mcp_audit_log` table:

```sql
CREATE TABLE mcp_audit_log (
  id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          VARCHAR2(36) REFERENCES users(id),
  tool_name        VARCHAR2(100) NOT NULL,
  params_hash      VARCHAR2(64) NOT NULL,       -- hash only, no raw params (may contain tickers = PII-adjacent)
  response_time_ms NUMBER(6),
  cache_hit        NUMBER(1) DEFAULT 0 NOT NULL,
  error            VARCHAR2(2000),
  created_at       TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP
)
PARTITION BY RANGE (created_at) INTERVAL (NUMTOYMINTERVAL(1,'MONTH'))
(PARTITION p_init VALUES LESS THAN (TIMESTAMP '2026-07-01 00:00:00'));
-- Retain 12 months, drop old partitions via DBMS_SCHEDULER job
CREATE INDEX idx_mcp_audit_user_date ON mcp_audit_log(user_id, created_at) LOCAL;
```

### 7.5 Circuit Breaker

```
State machine per MCP tool: CLOSED → OPEN → HALF_OPEN

CLOSED (normal):
  On each call: record success/failure in in-memory sliding window (1 min, 20 calls)
  If error_rate > 50%: transition to OPEN, set in-memory timer TTL 300s

OPEN (failing):
  All calls immediately return stub/cached response
  After TTL expires: transition to HALF_OPEN

HALF_OPEN (testing):
  Allow 1 call through per 30s
  Success → CLOSED
  Failure → OPEN (reset TTL 300s)

Error rate check:
  errors_in_window / total_in_window > 0.50 AND total_in_window >= 5
```

### 7.6 MCP Credential Rotation

Gateway token stored in Vault at `secret/mcp/gateway_token`. Rotation procedure:
1. Admin calls `POST /admin/mcp/rotate-token` with new token in body (HTTPS only, admin role)
2. Server updates Vault, flushes in-memory token cache
3. Next MCP call uses new token
4. Old token invalidated at gateway level (out of scope: gateway admin)

---

## 8. Broker Credential Security

### 8.1 Encryption Scheme

**Algorithm**: AES-256-GCM (authenticated encryption — provides both confidentiality and integrity)  
**Key**: 256-bit master encryption key (MEK). Source: Vault path `secret/broker_credentials/mek` or env var `BROKER_MEK` (hex-encoded 32 bytes). Never in DB.  
**IV**: 96-bit random IV, unique per encrypt operation (stored alongside ciphertext)  
**Auth tag**: 128-bit GCM auth tag (stored alongside ciphertext)

**Encryption pseudocode**:
```
function encrypt(plaintext: string, mek: Buffer): EncryptedBlob {
  iv = crypto.randomBytes(12)                          // 96-bit IV
  cipher = crypto.createCipheriv('aes-256-gcm', mek, iv)
  ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  authTag = cipher.getAuthTag()                        // 16 bytes
  return {
    version: 1,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64')
  }
}

function decrypt(blob: EncryptedBlob, mek: Buffer): string {
  iv = Buffer.from(blob.iv, 'base64')
  ciphertext = Buffer.from(blob.ciphertext, 'base64')
  authTag = Buffer.from(blob.authTag, 'base64')
  decipher = crypto.createDecipheriv('aes-256-gcm', mek, iv)
  decipher.setAuthTag(authTag)
  plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
```

**Storage format** (stored as CLOB with IS JSON constraint in DB):
```typescript
interface EncryptedBlob {
  version: number;          // encryption scheme version (for rotation support)
  iv: string;               // base64
  ciphertext: string;       // base64
  authTag: string;          // base64
}
```

### 8.2 Credential Lifecycle

**Schema**:
```sql
CREATE TABLE broker_credentials (
  id                       VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id                  VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker                   VARCHAR2(30) NOT NULL,         -- "alpaca" | "ibkr" | "saxo" | "trading212" | "binance"
  label                    VARCHAR2(100) NOT NULL,        -- user-defined label
  credentials_encrypted    CLOB NOT NULL                  -- EncryptedBlob JSON wrapping broker-specific JSON
                           CONSTRAINT chk_bc_json CHECK (credentials_encrypted IS JSON),
  credential_hash          VARCHAR2(64) NOT NULL,         -- SHA-256(plaintext_creds) for dedup
  validated_at             TIMESTAMP,                     -- last successful test call
  validation_error         VARCHAR2(2000),                -- last validation error if any
  consecutive_auth_failures NUMBER(3) DEFAULT 0 NOT NULL,
  auto_disconnected_at     TIMESTAMP,                     -- set on 3rd consecutive failure
  created_at               TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP,
  updated_at               TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_bc_user_broker_label UNIQUE (user_id, broker, label)
);
```

**Linking (credential validation on add)**:
```
POST /api/v1/brokers/{broker}/credentials
Body: { broker-specific fields, label }

1. Encrypt plaintext credentials blob → EncryptedBlob
2. Compute credential_hash = SHA-256(JSON.stringify(sorted_keys(plaintext)))
3. Check for existing duplicate: SELECT WHERE user_id AND broker AND credential_hash → 409 if exists
4. INSERT into broker_credentials (credentials_encrypted, credential_hash, ...)
5. Immediately run validation: decrypt → make test API call to broker (e.g., GET /v2/account for Alpaca)
6. On success: set validated_at = now(); return 201
7. On failure: set validation_error; return 422 { "error": "credential_validation_failed", "detail": "<broker error>" }
8. Plaintext NEVER written to DB, logs, or response body
```

**Runtime decryption (execution session only)**:
```
1. Fetch EncryptedBlob from DB
2. Load MEK from Vault (cached in process memory, refreshed every 5 min)
3. Decrypt → plaintext credentials string
4. Parse → broker-specific struct
5. Pass to broker adapter in-memory (never serialize back to string)
6. Zero-fill memory buffer when done (set all bytes to 0x00)
7. Decrypted credentials NEVER written to logs, files, or sent over network
```

**Auto-disconnect on auth failures**:
```
On each broker API call:
  if response.status == 401 or 403:
    UPDATE broker_credentials SET consecutive_auth_failures = consecutive_auth_failures + 1
    if consecutive_auth_failures >= 3:
      UPDATE broker_credentials SET auto_disconnected_at = now()
      Send Telegram notification to user: "Broker {label} disconnected due to auth failures"
      Return error to caller, stop execution session
  else:
    UPDATE broker_credentials SET consecutive_auth_failures = 0
```

### 8.3 Credential Access Audit

Every credential access (decrypt operation) logged:
```sql
CREATE TABLE credential_access_log (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  credential_id VARCHAR2(36) NOT NULL REFERENCES broker_credentials(id),
  user_id       VARCHAR2(36) NOT NULL,
  purpose       VARCHAR2(30) NOT NULL,          -- "execution_session" | "validation" | "rotation"
  ip_address    VARCHAR2(45),
  request_id    VARCHAR2(64),                   -- trace ID
  created_at    TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP
);
-- Retain 90 days. Partition by month via Oracle interval partitioning.
```

---

## 9. Data Isolation (Multi-Tenant)

### 9.1 Oracle Virtual Private Database (VPD)

Oracle Autonomous DB provides VPD for row-level security — enforced at the database engine level. See PRD-14 §9 for the full VPD policy implementation (`dt_vpd_policy`, `dt_security_pkg`).

**Go connection middleware**:
```go
func setDBContext(conn *sql.Conn, userID, role string) error {
    _, err := conn.ExecContext(ctx,
        "BEGIN dt_security_pkg.set_user(:1, :2); END;",
        userID, role)
    return err
}
```

Called on every connection checkout from `godror` pool. VPD policy returns:
- `NULL` predicate for `admin`, `operator`, `monitor` (no filtering)
- `user_id = SYS_CONTEXT('DT_CTX','USER_ID')` for all `member-*` roles

**Tables with VPD isolation**: `broker_links`, `broker_credentials`, `subscriptions`, `api_keys`, `refresh_tokens`, `execution_logs`, `pipeline_runs`, `team_members`, `oauth_identities`.

### 9.2 API Ownership Validation

VPD handles row filtering transparently. Middleware sets the DB context before any query:

```go
func ownershipMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := r.Context().Value(ctxUserID).(string)
        role := r.Context().Value(ctxRole).(string)
        conn, _ := pool.Conn(r.Context())
        setDBContext(conn, userID, role)
        ctx := context.WithValue(r.Context(), ctxConn, conn)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Rule**: Any `GET /resource/{id}` or `DELETE /resource/{id}` must return 404 (not 403) when the resource exists but belongs to another user. This prevents resource enumeration.

### 9.3 File Storage Isolation

Execution logs, backtest outputs, and exported files stored in Oracle Object Storage (10 GB free tier):
```
oci://dt-storage/users/{user_id}/{resource_type}/{file_id}.{ext}
```

**Path traversal prevention**:
- `user_id` and `file_id` are UUIDs (validated regex before use in path)
- No user-controlled strings in file paths
- OCI IAM policy: application service principal scoped to `dt-storage` bucket only

### 9.4 Execution Logs Isolation

Each execution session writes logs to isolated storage:
```sql
CREATE TABLE execution_logs (
  id         VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id    VARCHAR2(36) NOT NULL REFERENCES users(id),
  session_id VARCHAR2(36) NOT NULL,
  mode_id    VARCHAR2(30),
  broker     VARCHAR2(30),
  log_level  VARCHAR2(10) CONSTRAINT chk_el_level CHECK (log_level IN ('info','warn','error')),
  message    VARCHAR2(4000) NOT NULL,
  metadata   JSON,                                    -- no credentials
  created_at TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP
);
CREATE INDEX idx_exec_logs_user ON execution_logs(user_id, created_at);
```

Logs encrypted at rest via Oracle Autonomous DB Transparent Data Encryption (TDE) — enabled by default, AES-256. VPD policy applied (see PRD-14 §9).

---

## 10. Infrastructure Security

### 10.1 Security Headers

All HTTP responses include:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://api.dailytickers.com wss://streamer.finance.yahoo.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**TLS**: Minimum TLS 1.2. Recommended TLS 1.3. Cipher suites: prefer ECDHE. Reject RC4, 3DES, NULL. HSTS preload list submission required.

### 10.2 RBAC Role Definitions

8 roles in a clear hierarchy. Each user has exactly one role. See PRD-14 §3.1 for assignment rules (Stripe-managed vs manual).

```typescript
const ROLE_PERMISSIONS = {
  // --- Platform staff roles (manually assigned) ---
  admin: [
    "*"  // all permissions: cross-user read/write, system config, user management, billing override
  ],
  operator: [
    "read:all_users", "manage:users", "read:all_portfolios", "read:all_analytics",
    "trigger:pipelines", "read:audit_log", "manage:subscriptions",
    // Cannot: change system config, manage admin roles, access billing settings
  ],
  monitor: [
    "read:all_users", "read:all_portfolios", "read:all_analytics",
    "read:audit_log", "read:system_health"
    // Read-only cross-tenant. No writes, no execution. For oversight/compliance.
  ],

  // --- Member roles (Stripe-managed or manual for free/elite) ---
  "member-free": [
    "read:own_signals", "read:own_portfolio", "read:market_data"
    // Paper mode only, 2 strategy slots, no API keys, no notifications
  ],
  "member-basic": [
    "read:own_signals", "read:own_portfolio", "read:own_analytics", "read:market_data",
    "write:own_analytics", "run:backtest", "manage:own_credentials", "manage:own_api_keys"
    // Paper execution, 4 slots, 1 broker, read-only API, Telegram notifs
  ],
  "member-pro": [
    "read:own_signals", "read:own_portfolio", "read:own_analytics", "read:market_data",
    "write:own_orders", "write:own_config", "write:own_analytics",
    "run:backtest", "run:optimizer", "run:recalibrate",
    "manage:own_credentials", "manage:own_api_keys", "api:programmatic"
    // Live execution, unlimited slots, 5 brokers, full API, Telegram + Discord
  ],
  "member-team": [
    "...member-pro...",
    "manage:team_members", "read:team_portfolios", "share:strategies"
    // Shared workspace, 10 brokers pool, up to 5 seats, Slack integration
  ],
  "member-elite": [
    "...member-pro...",
    "read:all_portfolios", "read:all_analytics", "api:admin_read",
    "priority:support", "unlimited:brokers"
    // VIP: admin-level read access, unlimited brokers, priority support
  ]
};
```

**Permission check middleware** (applied after auth):
```
1. Extract role from JWT claims
2. Check role has required permission for endpoint
3. For member-* roles: additionally check tier feature gate (§10.2b)
4. For operator/monitor: allow cross-tenant read but enforce write restrictions
5. Return 403 { "error": "insufficient_permissions" } if denied
```

**Tier-based feature gating** (checked after role check for member-* roles):
```typescript
const TIER_FEATURES = {
  free:    { slots: 2,  brokers: 0, execution: "none",  notifications: [],                api: "none" },
  basic:   { slots: 4,  brokers: 1, execution: "paper", notifications: ["telegram"],       api: "read" },
  pro:     { slots: -1, brokers: 5, execution: "live",  notifications: ["telegram","discord"], api: "full" },
  team:    { slots: -1, brokers: 10, execution: "live", notifications: ["telegram","discord","slack"], api: "full" },
  elite:   { slots: -1, brokers: -1, execution: "live", notifications: ["all"],             api: "full" }
  // -1 = unlimited
};
```

### 10.3 Secret Management

**Hierarchy** (preferred → fallback):
1. Oracle Cloud Vault (production, free tier — up to 20 secrets): secrets loaded at service startup via OCI SDK, cached in process memory only
2. Environment variables: acceptable for development only, never in container images

**Never in**:
- Source code
- Container images (`docker history` attack)
- Git history
- API responses
- Application logs (redacted via log filter)

**Log redaction filter**: Regex patterns applied to all log output before writing:
```
/dt_(live|test)_[A-Za-z0-9]{40,}/g → "[API_KEY_REDACTED]"
/Bearer [A-Za-z0-9\-._~+\/]+=*/g   → "[TOKEN_REDACTED]"
/(password|secret|key|token)["']?\s*[:=]\s*["']?[^"',\s]{8,}/gi → "[SECRET_REDACTED]"
```

### 10.4 Container Security

```dockerfile
# Multi-stage: build in Go image, run in scratch/distroless
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=1 go build -o /autotrader ./cmd/autotrader

FROM alpine:3.20
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /autotrader /usr/local/bin/autotrader
USER app
ENTRYPOINT ["/usr/local/bin/autotrader"]
```

**Network**: Oracle Autonomous DB accessible via private endpoint (mTLS wallet). MCP gateway on private subnet. Only API gateway exposed publicly via OCI Load Balancer. Go binary connects to ATP via Oracle Wallet (downloaded from OCI console, stored in Oracle Vault).

### 10.5 Security Monitoring

**Alerts** (trigger Telegram + PagerDuty for critical):
```
CRITICAL (immediate):
  - Failed auth spike: >50 failed logins/min from same IP
  - Credential access anomaly: >10 decrypt ops for same user in 1 min
  - Admin privilege use: any request with admin role logged + alerted
  - Signing secret mismatch: >3 invalid signatures from same user in 5 min

WARNING (async):
  - Rate limit hits: >100 429 responses for same user in 1h
  - Unusual API patterns: burst of order endpoints after long inactivity
  - MCP circuit breaker OPEN: logged + alerted to on-call

INFO (logged only):
  - New API key created
  - Broker credential linked/unlinked
  - Refresh token rotation
```

**Anomaly detection queries** (run every 5 min via scheduler):
```sql
-- Unusual credential access
SELECT user_id, COUNT(*) as cnt FROM credential_access_log
WHERE created_at > now() - INTERVAL '1 hour'
GROUP BY user_id HAVING COUNT(*) > 20;

-- Brute-force detection
SELECT ip_address, COUNT(*) FROM auth_attempts
WHERE success = false AND created_at > now() - INTERVAL '15 minutes'
GROUP BY ip_address HAVING COUNT(*) > 20;
```

---

## 11. Audit Log Schema (Simplified)

> **Scale note**: ~25 users. Same Oracle Autonomous DB instance as the main schema. Partitioned for efficient retention management.

```sql
CREATE TABLE security_audit_log (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type    VARCHAR2(100) NOT NULL,   -- "auth.login" | "credential.link" | "order.place" | etc.
  user_id       VARCHAR2(36),
  resource_type VARCHAR2(50),             -- "broker_credential" | "api_key" | "order" | etc.
  resource_id   VARCHAR2(36),
  action        VARCHAR2(20) NOT NULL,    -- "create" | "read" | "update" | "delete" | "execute"
  outcome       VARCHAR2(20) NOT NULL,    -- "success" | "failure" | "blocked"
  ip_address    VARCHAR2(45),
  metadata      JSON,                     -- no secrets
  created_at    TIMESTAMP NOT NULL DEFAULT SYSTIMESTAMP
)
PARTITION BY RANGE (created_at) INTERVAL (NUMTOYMINTERVAL(1,'MONTH'))
(PARTITION p_init VALUES LESS THAN (TIMESTAMP '2026-07-01 00:00:00'));

CREATE INDEX idx_sec_audit_user ON security_audit_log(user_id, created_at) LOCAL;
CREATE INDEX idx_sec_audit_event ON security_audit_log(event_type, created_at) LOCAL;
```

**Immutability**: application DB user (`dt_app`) granted `INSERT` only on this table. No `UPDATE`/`DELETE` privilege. Retention cleanup (> 12 months) runs via `DBMS_SCHEDULER` job that drops old partitions.

**Secrets management**: Signing keys and broker MEK stored in Oracle Cloud Vault (free tier, up to 20 secrets). Loaded at service startup via OCI SDK. Fallback for local dev: env vars only (never in container images or source).

**Backup & Recovery**: Oracle Autonomous DB provides automatic daily backups with 60-day retention, point-in-time recovery (PITR), and on-demand backups to Oracle Object Storage — all included in the Always Free tier. Zero-ops.

---

## 12. Error Response Standards

Security-sensitive endpoints must NOT leak implementation details:

```typescript
// BAD: leaks DB schema
{ "error": "column user_id does not exist in table..." }

// BAD: leaks timing info (different message for wrong email vs wrong password)
{ "error": "email not found" }
{ "error": "wrong password" }

// GOOD: generic auth failure
{ "error": "invalid_credentials", "message": "Invalid email or password." }

// GOOD: validation error (safe to be specific)
{ "error": "validation_error", "fields": { "email": "invalid format" } }
```

**Stack traces**: Never included in API responses (any environment). Logged server-side only.  
**Internal service errors**: Map to generic 500 `{ "error": "internal_error", "request_id": "<trace_id>" }`. Trace ID allows support to correlate logs without exposing internals.
