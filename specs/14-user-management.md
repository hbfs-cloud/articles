# PRD-14: User & Subscription Management

**Status**: Specification  
**Version**: 1.0  
**Scope**: Multi-tenant SaaS layer — does not exist in current codebase

---

## 1. Overview

Adds user accounts, subscription tiers, and broker credential management to the DailyTickers AutoTrader platform. Every pipeline run, signal, and execution is scoped to a user. Tenants are fully isolated at the data layer.

---

## 2. Database Schema

> **Engine**: Oracle Autonomous Database (ATP) — Always Free tier, 20 GB storage, managed backups, auto-patching. Go driver: `godror` (Oracle Call Interface). Connection via Oracle Wallet (mTLS) downloaded from OCI console.

### 2.1 Users

```sql
CREATE TABLE users (
  id                     VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  email                  VARCHAR2(255) NOT NULL UNIQUE,
  password_hash          VARCHAR2(255),              -- bcrypt cost=12. NULL for OAuth-only accounts.
  name                   VARCHAR2(100),
  role                   VARCHAR2(20) DEFAULT 'member-free' NOT NULL
                         CONSTRAINT chk_users_role CHECK (role IN ('admin','operator','monitor','member-free','member-basic','member-pro','member-team','member-elite')),
  email_verified         NUMBER(1) DEFAULT 0,        -- 0=false, 1=true
  verification_token     VARCHAR2(64),               -- NULL once verified
  reset_token            VARCHAR2(64),               -- NULL when not in reset flow
  reset_token_expires_at TIMESTAMP,
  created_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  status                 VARCHAR2(20) DEFAULT 'active'
                         CONSTRAINT chk_users_status CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
```

### 2.2 Subscriptions

```sql
CREATE TABLE subscriptions (
  id                     VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id                VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                   VARCHAR2(20) NOT NULL
                         CONSTRAINT chk_sub_plan CHECK (plan IN ('free', 'basic', 'pro', 'team', 'elite')),
  modes                  JSON DEFAULT '["balanced"]',
                         -- Array of mode names: ["turbo","dynamic","balanced","secured","fortress","tkl"]
  max_brokers            NUMBER(3) DEFAULT 1 NOT NULL,
  max_seats              NUMBER(3) DEFAULT 1,        -- team plan: up to 5
  started_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  expires_at             TIMESTAMP,                  -- NULL = perpetual (elite/manual)
  trial_ends_at          TIMESTAMP,                  -- NULL if not in trial
  status                 VARCHAR2(20) DEFAULT 'trial'
                         CONSTRAINT chk_sub_status CHECK (status IN ('active', 'trial', 'past_due', 'expired', 'cancelled')),
  stripe_customer_id     VARCHAR2(100),
  stripe_subscription_id VARCHAR2(100),
  created_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_sub_user UNIQUE (user_id)            -- one active subscription per user
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
```

### 2.3 Broker Links

```sql
CREATE TABLE broker_links (
  id                     VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id                VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker                 VARCHAR2(30) NOT NULL
                         CONSTRAINT chk_bl_broker CHECK (broker IN ('paper','alpaca','ibkr','saxo','trading212','binance')),
  credentials_encrypted  CLOB NOT NULL               -- AES-256-GCM EncryptedBlob JSON, see §5
                         CONSTRAINT chk_bl_creds CHECK (credentials_encrypted IS JSON),
  paper_mode             NUMBER(1) DEFAULT 1,        -- 0=live, 1=paper
  capital_usd            NUMBER(12,2) DEFAULT 10000.00,
  modes                  JSON DEFAULT '[]',
                         -- StrategySlot preset names assigned to this broker link
  status                 VARCHAR2(20) DEFAULT 'active'
                         CONSTRAINT chk_bl_status CHECK (status IN ('active', 'disconnected', 'error')),
  error_message          VARCHAR2(2000),              -- last connection error, if any
  last_connected_at      TIMESTAMP,
  last_validated_at      TIMESTAMP,
  created_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at             TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_bl_user_broker UNIQUE (user_id, broker)
);

CREATE INDEX idx_broker_links_user_id ON broker_links(user_id);
CREATE INDEX idx_broker_links_status ON broker_links(status);
```

### 2.4 API Keys

```sql
CREATE TABLE api_keys (
  id           VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id      VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     VARCHAR2(64) NOT NULL UNIQUE,          -- SHA-256 of the raw key
  key_prefix   VARCHAR2(12) NOT NULL,                 -- first 8-12 chars shown in UI
  label        VARCHAR2(100),
  last_used_at TIMESTAMP,
  expires_at   TIMESTAMP,                             -- NULL = never
  created_at   TIMESTAMP DEFAULT SYSTIMESTAMP,
  revoked_at   TIMESTAMP                              -- NULL = active
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

### 2.5 Audit Log

```sql
CREATE TABLE audit_log (
  id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(id),
  actor       VARCHAR2(50) NOT NULL,                  -- 'user', 'system', 'admin', 'operator'
  action      VARCHAR2(100) NOT NULL,                 -- e.g. 'credentials.decrypt', 'broker.link', 'role.change'
  resource    VARCHAR2(200),                           -- e.g. 'broker_links:uuid'
  ip_address  VARCHAR2(45),                           -- IPv4 or IPv6
  user_agent  VARCHAR2(500),
  metadata    JSON,
  created_at  TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

---

## 3. Subscription Plans & Roles

> **Scale**: This platform targets ~25 users (personal use + invited users). No multi-org support. Single-tenant architecture with per-user data isolation.

### 3.1 Role Hierarchy

Roles determine **platform access level**. Subscription tier determines **feature entitlements** within that access level. A user has exactly one role.

| Role | Assignment | Description |
|------|-----------|-------------|
| `admin` | Manual (owner only) | Full system access — user management, config, all data cross-tenant |
| `operator` | Manual (by admin) | Manage users, view all portfolios, trigger pipelines. Cannot change system config or billing. |
| `monitor` | Manual (by admin) | Read-only cross-tenant view. Dashboard access, no writes, no execution. For oversight/compliance. |
| `member-free` | Auto (default) | Standard member on free tier |
| `member-basic` | Auto (Stripe) | Standard member on basic subscription |
| `member-pro` | Auto (Stripe) | Standard member on pro subscription |
| `member-team` | Auto (Stripe) | Team subscription — shared workspace, up to 5 seats |
| `member-elite` | Manual (by admin) | VIP access — all features, priority support, custom limits. Not purchasable via Stripe. |

**Role ↔ Tier mapping**: `member-*` roles are synced automatically from Stripe subscription status. `admin`, `operator`, `monitor`, `member-elite` are assigned manually via admin endpoints (§6.6). When a Stripe subscription changes (e.g., basic→pro), the role auto-updates to `member-pro`. Manual roles (`admin`, `operator`, `monitor`, `member-elite`) are never overwritten by Stripe events.

**Role column**: defined inline in the `users` table (§2.1). No separate ALTER needed.

### 3.2 Subscription Tiers

| Plan | StrategySlots | Max live brokers | Paper | Execution | Notifications | API access | Price |
|------|--------------|------------------|-------|-----------|---------------|------------|-------|
| free | 2 slots | 0 | yes | no | no | no | €0 |
| basic | 4 slots | 1 | yes | paper only | Telegram | read-only | €19/mo |
| pro | unlimited | 5 | yes | yes (live) | Telegram + Discord | full | €49/mo |
| team | unlimited | 10 (shared pool) | yes | yes (live) | Telegram + Discord + Slack | full + team endpoints | €149/mo (up to 5 seats) |
| elite | unlimited | unlimited | yes | yes (live) | All + priority | full + admin-level read | Manual (by invitation) |

**StrategySlot validation**: the `modes` array in `subscriptions` maps to StrategySlot presets the user may activate. On downgrade, excess slots are suspended (not deleted); positions are tracked but no new orders are placed.

**Trial**: all new accounts start on a 14-day pro trial (`trial_ends_at = NOW() + INTERVAL '14 days'`). At trial end, role transitions to `member-free` unless the user subscribes.

### 3.3 Team Seats

Team subscriptions have a `max_seats` column and a `team_members` join table:

```sql
CREATE TABLE team_members (
  id            VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  team_owner_id VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id     VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at    TIMESTAMP DEFAULT SYSTIMESTAMP,
  accepted_at   TIMESTAMP,
  role          VARCHAR2(20) DEFAULT 'member-team',
  CONSTRAINT uq_team_owner_member UNIQUE (team_owner_id, member_id)
);
CREATE INDEX idx_team_members_owner ON team_members(team_owner_id);
CREATE INDEX idx_team_members_member ON team_members(member_id);
```

Team owner invites members by email. Invited user gets `member-team` role and shares the owner's broker pool (read-only unless owner grants execution rights).

**UI auth pages**: login and registration use Foundation's split layout — brand panel on the left, form on the right. See PRD-11 §3 for the Foundation design system reference.

---

## 4. Authentication

Three auth methods supported: **password**, **OAuth2 social login**, and **API key**.

### 4.1 Password Auth + JWT Tokens

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

- **Access token**: RS256, expires in 15 minutes. Payload: `{ sub: userId, email, role, plan, iat, exp }` (see PRD-18 §2.1 for full schema).
- **Refresh token**: stored hashed in `refresh_tokens` table (one row per session). Rotation: each use issues a new refresh token and invalidates the old one.
- **Password storage**: bcrypt cost=12. Minimum 12 chars, 1 uppercase, 1 digit, 1 special.

### 4.2 OAuth2 Social Login

Users can register/login via Google or GitHub. No password required for OAuth-only accounts.

**Providers supported**:

| Provider | Client ID env var | Scopes |
|----------|------------------|--------|
| Google | `DT_OAUTH_GOOGLE_CLIENT_ID` | `openid email profile` |
| GitHub | `DT_OAUTH_GITHUB_CLIENT_ID` | `user:email read:user` |

**OAuth identity table**:
```sql
CREATE TABLE oauth_identities (
  id                      VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id                 VARCHAR2(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider                VARCHAR2(20) NOT NULL
                          CONSTRAINT chk_oauth_provider CHECK (provider IN ('google', 'github')),
  provider_id             VARCHAR2(255) NOT NULL,
  email                   VARCHAR2(255),
  access_token_encrypted  CLOB,
  refresh_token_encrypted CLOB,
  token_expires_at        TIMESTAMP,
  created_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at              TIMESTAMP DEFAULT SYSTIMESTAMP,
  CONSTRAINT uq_oauth_provider_id UNIQUE (provider, provider_id)
);
CREATE INDEX idx_oauth_provider ON oauth_identities(provider, provider_id);
CREATE INDEX idx_oauth_user ON oauth_identities(user_id);
```

**Flow**:
```
POST /api/v1/auth/oauth/authorize?provider=google
  → Returns { redirect_url } (Google/GitHub consent screen)

GET /api/v1/auth/oauth/callback?provider=google&code=...&state=...
  → Server exchanges code for tokens
  → Lookup oauth_identities by (provider, provider_id)
  → If found: login existing user → return JWT
  → If not found: create user (email from provider, email_verified=true,
    password_hash=NULL) + oauth_identities row → return JWT
  → Redirect to /dashboard with tokens in secure httpOnly cookie or fragment
```

**Account linking**: existing password user can link OAuth via `POST /api/v1/auth/oauth/link?provider=github` (requires active session). Multiple providers can be linked to one account.

**Password-optional**: users who signed up via OAuth have `password_hash = NULL`. They can set a password later via `POST /api/v1/auth/set-password` (requires active session). Login via password is blocked if `password_hash IS NULL`.

### 4.3 API Key Auth

`Authorization: ApiKey <raw_key>`. Middleware hashes the raw key (SHA-256), looks up `api_keys` by hash, verifies `revoked_at IS NULL` and `expires_at > NOW()`. See PRD-18 §3 for scopes and key format.

### 4.4 Rate Limiting

Applied per `user_id` (authenticated) or `ip_address` (anonymous). Single generous limit for all authenticated users — no per-tier differentiation at this scale.

| Scope      | Requests/min |
|------------|-------------|
| anonymous  | 20          |
| authenticated (any plan) | 10,000 |

Rate limit enforced via in-memory token bucket (`golang.org/x/time/rate`). No Redis required for rate limiting.

### 4.5 OAuth2 Broker Linking

Separate from social login. Alpaca and Saxo support OAuth2 for broker credential exchange:

1. Client calls `POST /api/brokers/link` with `{ broker: "alpaca", oauth: true }`.
2. Server returns `{ redirect_url: "https://app.alpaca.markets/oauth/authorize?client_id=...&redirect_uri=...&state=<csrf>" }`.
3. User authorizes. Broker redirects to `GET /api/brokers/oauth/callback?code=<code>&state=<csrf>`.
4. Server exchanges code for `access_token` + `refresh_token`. Encrypts and stores in `broker_links.credentials_encrypted`.
5. Server returns `{ broker_link_id: uuid, status: "active" }` to the client.

IBKR, Trading212, Binance, and paper mode use API key / secret pairs submitted directly via `POST /api/brokers/link`.

---

## 5. Credential Security

### 5.1 Encryption Scheme

All broker credentials are encrypted at rest using AES-256-GCM before being stored in `broker_links.credentials_encrypted`.

```
Master key: 32-byte random, stored in env var BROKER_MASTER_KEY (base64-encoded).
             Never stored in the database.
Per-record key derivation: HKDF-SHA256(masterKey, salt=brokerId+userId, info="broker-credentials")
IV: 12-byte random, generated fresh per encryption operation.
```

**Encrypted record format** (stored as JSON TEXT):
```json
{
  "version": 1,
  "algorithm": "aes-256-gcm",
  "iv": "<base64(12 bytes)>",
  "ciphertext": "<base64(encrypted payload)>",
  "tag": "<base64(16-byte GCM auth tag)>",
  "kdf": "hkdf-sha256",
  "salt": "<base64(userId+brokerId concatenated)>"
}
```

**Plaintext payload** (before encryption):
```json
{
  "alpaca": { "api_key": "...", "api_secret": "..." },
  "ibkr":   { "host": "...", "port": 4001, "account_id": "..." },
  "saxo":   { "access_token": "...", "refresh_token": "...", "token_expires_at": "..." },
  "trading212": { "api_key": "..." },
  "binance": { "api_key": "...", "api_secret": "..." },
  "paper":  {}
}
```

### 5.2 Decryption Policy

- Credentials decrypted **only** at execution time by `trading-executor/adapters/*.js`.
- Decrypted value held in memory only for the duration of the broker session (never written to disk or logs).
- Every decryption emits an `audit_log` record: `action = "credentials.decrypt"`.
- Decryption function signature: `async decryptCredentials(brokerLinkId: string): Promise<PlaintextCredentials>`.

---

## 6. API Endpoints

All endpoints are prefixed with `/api/v1`. JSON request/response bodies throughout.

### 6.1 Auth

```
POST /api/v1/auth/register
  Body:    { email, password, name? }
  Returns: { user_id, message: "Verification email sent" }
  Errors:  409 if email already registered; 422 if password < 12 chars

POST /api/v1/auth/verify-email
  Body:    { token }
  Returns: { access_token, refresh_token, expires_in }

POST /api/v1/auth/login
  Body:    { email, password }
  Returns: { access_token, refresh_token, expires_in }
  Errors:  401 invalid credentials; 403 if status = suspended

POST /api/v1/auth/refresh
  Body:    { refresh_token }
  Returns: { access_token, refresh_token, expires_in }
  Errors:  401 if token expired or already rotated

POST /api/v1/auth/logout
  Body:    { refresh_token }
  Effect:  Invalidates that refresh token row
  Returns: { message: "Logged out" }

POST /api/v1/auth/forgot-password
  Body:    { email }
  Returns: { message: "If that email exists, a reset link was sent" }

POST /api/v1/auth/reset-password
  Body:    { token, new_password }
  Returns: { message: "Password updated" }
  Errors:  400 if token expired (TTL = 1 hour)
```

### 6.2 User Profile

```
GET  /api/v1/users/me
  Auth:    Bearer access_token
  Returns: { id, email, name, status, created_at, subscription: { plan, modes, expires_at, status } }

PATCH /api/v1/users/me
  Auth:    Bearer access_token
  Body:    { name?, email?, current_password? (required if changing email/password), new_password? }
  Returns: { id, email, name, updated_at }
  Errors:  409 if new email already taken

DELETE /api/v1/users/me
  Auth:    Bearer access_token
  Body:    { password }
  Effect:  Sets status='deleted', schedules data purge in 30 days
  Returns: { message: "Account scheduled for deletion" }
```

### 6.3 Subscriptions

```
GET  /api/v1/subscriptions/current
  Auth:    Bearer access_token
  Returns: {
    id, plan, modes, max_brokers, status,
    started_at, expires_at, trial_ends_at,
    stripe_customer_id
  }

POST /api/v1/subscriptions/upgrade
  Auth:    Bearer access_token
  Body:    { plan: "pro", strategy_slots: [...], stripe_payment_method_id? }
  Returns: { subscription_id, status, stripe_checkout_url? }
  Notes:   If payment is required, returns Stripe checkout URL. Otherwise returns immediately.

POST /api/v1/subscriptions/cancel
  Auth:    Bearer access_token
  Effect:  Sets status='cancelled' at period end (does not immediately revoke access)
  Returns: { message, access_until }

POST /api/v1/subscriptions/strategy-slots
  Auth:    Bearer access_token
  Body:    { strategy_slots: ["balanced", "secured"] }
  Errors:  400 if strategy_slots.length > plan limit; 400 if invalid preset name
  Returns: { strategy_slots }
```

### 6.4 Broker Links

```
GET  /api/v1/brokers
  Auth:    Bearer access_token
  Returns: [{
    id, broker, paper_mode, capital_usd, modes,
    status, last_connected_at, error_message
    -- credentials_encrypted is NEVER returned
  }]

POST /api/v1/brokers/link
  Auth:    Bearer access_token
  Body:    {
    broker: "alpaca"|"ibkr"|"saxo"|"trading212"|"binance"|"paper",
    oauth: false,
    credentials: { api_key, api_secret },  -- broker-specific, see §5
    capital_usd: 10000,
    modes: ["balanced"],
    paper_mode: false
  }
  Errors:
    400 if modes not in user's subscription modes
    400 if live broker count would exceed plan max_brokers
    400 if broker already linked
    422 if credentials fail live validation check
  Returns: { id, broker, status, last_connected_at }

POST /api/v1/brokers/link (OAuth flow)
  Body:    { broker: "alpaca", oauth: true, capital_usd, modes }
  Returns: { redirect_url }

GET  /api/v1/brokers/oauth/callback
  Query:   code, state
  Effect:  Exchanges code, encrypts, stores, returns to frontend
  Returns: Redirect to /dashboard?broker_linked=alpaca

PATCH /api/v1/brokers/{id}
  Auth:    Bearer access_token
  Body:    { capital_usd?, modes?, paper_mode?, credentials? }
  Returns: { id, broker, capital_usd, modes, paper_mode, status }

DELETE /api/v1/brokers/{id}
  Auth:    Bearer access_token
  Effect:  Deletes broker_links row; running executions complete but no new ones start
  Returns: { message: "Broker unlinked" }

POST /api/v1/brokers/{id}/validate
  Auth:    Bearer access_token
  Effect:  Decrypts credentials, runs a balance check against the broker API
  Returns: { valid: true, balance_usd, last_connected_at } or { valid: false, error }
```

### 6.5 API Keys

```
GET  /api/v1/api-keys
  Returns: [{ id, key_prefix, label, last_used_at, expires_at, created_at }]

POST /api/v1/api-keys
  Body:    { label?, expires_at? }
  Returns: { id, key_prefix, raw_key, label, expires_at }
  Note:    raw_key is returned ONCE. Store it; it cannot be retrieved again.

DELETE /api/v1/api-keys/{id}
  Effect:  Sets revoked_at = NOW()
  Returns: { message: "API key revoked" }
```

---

## 7. Registration Flow (State Machine)

### 7.1 Password Registration

```
UNREGISTERED
     │ POST /auth/register (email + password)
     ▼
PENDING_VERIFICATION
     │ click link in email (token valid for 24h)
     ▼
ACTIVE (trial, 14 days, role=member-free)
     │ trial_ends_at reached + no upgrade
     ▼
FREE (role=member-free)
     │ POST /subscriptions/upgrade (Stripe checkout)
     ▼
ACTIVE (paid, role=member-basic|member-pro|member-team)
     │ POST /subscriptions/cancel
     ▼
CANCELLED (access until period end)
     │ period end → Stripe webhook invoice.payment_failed
     ▼
FREE (role=member-free)
```

### 7.2 OAuth2 Registration

```
UNREGISTERED
     │ GET /auth/oauth/authorize?provider=google
     │ → Google consent → callback with code
     ▼
ACTIVE (trial, 14 days, role=member-free, email_verified=true)
     │ ... (same upgrade/cancel flow as above)
```

OAuth users skip email verification (provider already verified the email).

**Email verification token**: 64-char random hex, stored in `users.verification_token`, cleared on use. Resend endpoint: `POST /api/v1/auth/resend-verification`.

---

## 8. Broker Linking Wizard (UI Flow)

1. User opens `/dashboard/brokers/add`.
2. Selects broker from list. Each broker shows required credential fields.
3. For OAuth brokers (Alpaca, Saxo): redirect to broker OAuth page, return via callback.
4. For key-based brokers: form with fields defined per broker:

```json
{
  "alpaca":      ["api_key", "api_secret"],
  "ibkr":        ["host", "port", "account_id"],
  "saxo":        ["access_token"],
  "trading212":  ["api_key"],
  "binance":     ["api_key", "api_secret"],
  "paper":       []
}
```

5. User sets `capital_usd` and selects which modes to assign this broker.
6. `POST /api/v1/brokers/{id}/validate` is called automatically after linking.
7. On success: broker card appears in dashboard with status badge.

---

## 9. Tenant Data Isolation

Oracle Autonomous DB supports Virtual Private Database (VPD) for row-level security.

- **VPD policy**: applied to all user-data tables. Application context `DT_CTX` sets `user_id` and `role` at session start.
- `member-*` roles see only rows where `user_id = SYS_CONTEXT('DT_CTX','USER_ID')`.
- `operator` and `monitor` roles bypass VPD (read-only cross-tenant for monitor, read+manage for operator). `admin` has unrestricted access.
- VPD policy function returns NULL predicate (no filtering) for admin/operator/monitor roles.

```sql
-- Application context (set at start of each DB session)
CREATE OR REPLACE CONTEXT dt_ctx USING dt_security_pkg;

-- Security package
CREATE OR REPLACE PACKAGE dt_security_pkg AS
  PROCEDURE set_user(p_user_id VARCHAR2, p_role VARCHAR2);
END;
/

CREATE OR REPLACE PACKAGE BODY dt_security_pkg AS
  PROCEDURE set_user(p_user_id VARCHAR2, p_role VARCHAR2) IS
  BEGIN
    DBMS_SESSION.SET_CONTEXT('DT_CTX', 'USER_ID', p_user_id);
    DBMS_SESSION.SET_CONTEXT('DT_CTX', 'ROLE', p_role);
  END;
END;
/

-- VPD policy function
CREATE OR REPLACE FUNCTION dt_vpd_policy(schema_name VARCHAR2, table_name VARCHAR2)
  RETURN VARCHAR2 IS
  v_role VARCHAR2(20) := SYS_CONTEXT('DT_CTX', 'ROLE');
BEGIN
  IF v_role IN ('admin', 'operator', 'monitor') THEN
    RETURN NULL;  -- no filtering
  END IF;
  RETURN 'user_id = SYS_CONTEXT(''DT_CTX'', ''USER_ID'')';
END;
/

-- Apply to all user-data tables
BEGIN
  DBMS_RLS.ADD_POLICY(object_name => 'BROKER_LINKS',     policy_name => 'DT_ISOLATION', function_schema => USER, policy_function => 'DT_VPD_POLICY');
  DBMS_RLS.ADD_POLICY(object_name => 'SUBSCRIPTIONS',    policy_name => 'DT_ISOLATION', function_schema => USER, policy_function => 'DT_VPD_POLICY');
  DBMS_RLS.ADD_POLICY(object_name => 'API_KEYS',         policy_name => 'DT_ISOLATION', function_schema => USER, policy_function => 'DT_VPD_POLICY');
  DBMS_RLS.ADD_POLICY(object_name => 'TEAM_MEMBERS',     policy_name => 'DT_ISOLATION', function_schema => USER, policy_function => 'DT_VPD_POLICY');
  DBMS_RLS.ADD_POLICY(object_name => 'OAUTH_IDENTITIES', policy_name => 'DT_ISOLATION', function_schema => USER, policy_function => 'DT_VPD_POLICY');
END;
/
```

- **Go middleware**: calls `dt_security_pkg.set_user(:userId, :role)` on each connection checkout from the pool.
- Oracle Object Storage: user exports/logs prefixed with `users/{userId}/`.
- Pipeline runs scoped to `user_id` in `pipeline_runs` table.
- **Backups**: Oracle Autonomous DB provides automatic daily backups (60-day retention) + on-demand backups to Oracle Object Storage. Zero-ops.

---

## 10. Password Policy

- Minimum 12 characters.
- Must contain at least one uppercase letter, one digit, one special character (`!@#$%^&*`).
- Bcrypt cost factor: 12.
- No password reuse check (not required for initial version).
- Reset token TTL: 1 hour. One active reset token per user (issuing a new one invalidates the previous).

---

## 11. Subscription Upgrade / Downgrade Logic

**Upgrade** (e.g. free → pro):
1. Stripe checkout session created via `POST /api/v1/subscriptions/upgrade`.
2. User completes payment on Stripe-hosted checkout page.
3. On Stripe `checkout.session.completed` webhook: update `subscriptions` row (`plan`, `modes`, `max_brokers`, `status='active'`, `expires_at`) and user `role` to matching `member-*`.
4. Newly unlocked modes are immediately available for pipeline runs.

**Downgrade** (e.g. pro → basic):
1. User selects modes to keep within new plan limit (others are suspended, not deleted).
2. Excess broker links set to `paper_mode=true` (live execution suspended).
3. Downgrade takes effect at next billing period end.
4. Stripe `customer.subscription.updated` webhook updates plan + role.
5. Suspended modes display a "Upgrade to reactivate" banner in the dashboard.

**Cancellation**:
1. Stripe subscription cancelled at period end.
2. `subscriptions.status = 'cancelled'`, `expires_at` = billing period end.
3. At `expires_at` (via `customer.subscription.deleted` webhook): plan reverts to `free`, role → `member-free`.
4. User data retained for 90 days; can resubscribe and restore.

---

## 12. Stripe Webhook Handling

**Endpoint**: `POST /api/v1/webhooks/stripe` (no auth — verified via Stripe signature)

**Verification**: every webhook request verified using `Stripe-Signature` header + webhook secret (`DT_STRIPE_WEBHOOK_SECRET`). Reject with 400 if signature invalid.

**Handled events**:

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Activate subscription, set role to `member-{plan}`, set `stripe_customer_id` + `stripe_subscription_id` |
| `invoice.paid` | Extend `expires_at` to next billing period |
| `invoice.payment_failed` | Set subscription `status='past_due'`, send Telegram notification to user |
| `customer.subscription.updated` | Update `plan`, `modes`, `max_brokers`, sync `role` to new plan |
| `customer.subscription.deleted` | Set `status='cancelled'`, schedule role downgrade to `member-free` at period end |
| `customer.subscription.trial_will_end` | Send email + Telegram reminder (3 days before trial end) |

**Idempotency**: store `stripe_event_id` in `processed_webhooks` table. Skip if already processed.

```sql
CREATE TABLE processed_webhooks (
  event_id     VARCHAR2(100) PRIMARY KEY,
  event_type   VARCHAR2(100) NOT NULL,
  processed_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
```

**Role sync rule**: on any subscription change event, compute the target role from the new plan:
```
free → member-free
basic → member-basic
pro → member-pro
team → member-team
```
Skip role update if current role is `admin`, `operator`, `monitor`, or `member-elite` (manual roles are never overwritten by Stripe).

**Stripe Products** (configured in Stripe Dashboard, IDs in env vars):

| Env var | Plan |
|---------|------|
| `DT_STRIPE_PRICE_BASIC` | basic (€19/mo) |
| `DT_STRIPE_PRICE_PRO` | pro (€49/mo) |
| `DT_STRIPE_PRICE_TEAM` | team (€149/mo, up to 5 seats) |

**Customer portal**: `POST /api/v1/subscriptions/portal` returns a Stripe Customer Portal URL for self-service billing management (update payment method, view invoices, cancel).

---

## 13. Admin Role Management

Endpoints for manual role assignment. Restricted to `admin` role only.

### 13.1 Endpoints

```
GET /api/v1/admin/users
  Auth:    Bearer (admin only)
  Query:   ?role=operator&status=active&page=1&limit=20
  Returns: { users: [{ id, email, name, role, status, subscription, created_at }], total, page }

GET /api/v1/admin/users/{id}
  Auth:    Bearer (admin only)
  Returns: Full user profile including subscription, broker links (no credentials), API keys, audit log

PATCH /api/v1/admin/users/{id}/role
  Auth:    Bearer (admin only)
  Body:    { role: "operator" | "monitor" | "member-elite" | "member-free" }
  Effect:  Updates user role. Emits audit_log entry. Sends email notification to user.
  Returns: { id, email, role, previous_role }
  Notes:   Cannot set role to member-basic/pro/team (Stripe-managed).
           Cannot remove own admin role (safety).

PATCH /api/v1/admin/users/{id}/status
  Auth:    Bearer (admin only)
  Body:    { status: "active" | "suspended" }
  Effect:  Suspend/reactivate user. Suspended users cannot login or execute.
  Returns: { id, email, status, previous_status }

DELETE /api/v1/admin/users/{id}
  Auth:    Bearer (admin only)
  Effect:  Soft-delete (status='deleted'). Data purge after 30 days.
  Returns: { message: "User scheduled for deletion" }
```

### 13.2 Manual Role Assignment Rules

| Target Role | Who Can Assign | Stripe Override |
|-------------|---------------|-----------------|
| `admin` | Owner (first admin) only | Never |
| `operator` | Any admin | Never |
| `monitor` | Any admin | Never |
| `member-free` | Any admin (force downgrade) | Only if no active Stripe sub |
| `member-basic` | Stripe only | Always |
| `member-pro` | Stripe only | Always |
| `member-team` | Stripe only | Always |
| `member-elite` | Any admin | Never (elite = manual VIP) |

### 13.3 Audit Trail

Every admin action creates an audit entry:
```json
{
  "event_type": "admin.role_change",
  "user_id": "<target_user_id>",
  "action": "update",
  "metadata": {
    "admin_id": "<admin_user_id>",
    "previous_role": "member-free",
    "new_role": "operator",
    "reason": "Promoted to operations team"
  }
}
```

---

## 14. Error Response Format

All API errors follow:
```json
{
  "error": {
    "code": "BROKER_ALREADY_LINKED",
    "message": "A link for alpaca already exists. Remove it first.",
    "field": "broker"
  }
}
```

Standard error codes: `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `PLAN_LIMIT_EXCEEDED`, `BROKER_VALIDATION_FAILED`, `TOKEN_EXPIRED`, `NOT_FOUND`, `RATE_LIMITED`, `ROLE_CHANGE_FORBIDDEN`, `STRIPE_MANAGED_ROLE`.
