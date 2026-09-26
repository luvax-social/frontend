# Verified Authentication Contract

> Record of work done on 2026-08-01. Not maintained; it is correct as of that date and is not updated as the code moves.

Every statement in this document was verified twice.
Once by reading the backend request record and its validation annotations.
Once by issuing the request against a running server and recording the response.

Backend commit under test: `450212e` on `develop`.
Server: `http://localhost:8080/api/v1`.

All responses are wrapped in the `ApiResponse<T>` envelope: `{ success, code, message, data, timestamp }`.
The error identifier lives on `code`, not on `errorCode`.
This mattered: see the login section.

---

## Summary of every mismatch found

| # | Endpoint | Frontend sent | Backend expects | Result before fix |
|---|----------|---------------|-----------------|-------------------|
| 1 | `POST /auth/login` | `email` | `identifier` | `400 MALFORMED_REQUEST_BODY` |
| 2 | `POST /auth/reset-password` | `token`, `email`, `newPassword` | `token`, `newPassword` only | `400 MALFORMED_REQUEST_BODY` |
| 3 | Login error handling | reads `data.errorCode === 'EMAIL_NOT_VERIFIED'` | `data.code === 'AUTH_EMAIL_NOT_VERIFIED'` | unverified users never reached the notice screen |
| 4 | Register username rule | `^[a-zA-Z0-9_]+$` | `^[a-zA-Z0-9_.]+$` | form rejected valid usernames containing a dot |
| 5 | Register password rule | min 8 + uppercase + digit | `@Size(min = 8, max = 128)` only | form rejected valid passwords; no max length check |

Two claims in the task brief were investigated and found to be false.
They are recorded here so the next reader does not act on them.

| Claim | Finding |
|-------|---------|
| "Registration requires a `username` field that the frontend form may not collect" | False. The form already collected `username`, and `authApi.register` already sent it. Register was the one auth endpoint whose wire shape was already correct. |
| Login accepts an email or a username in `identifier` | True, and verified by experiment. Both forms returned `200` with a token pair. |

---

## Register

`POST /auth/register`

The request record is annotated `@JsonIgnoreProperties(ignoreUnknown = false)`.
Any field not listed below causes `400 MALFORMED_REQUEST_BODY` before validation runs.

| Field | Required | Rule |
|-------|----------|------|
| `username` | yes | `@NotBlank`, `@Size(min = 3, max = 30)`, `@Pattern(^[a-zA-Z0-9_.]+$)` |
| `email` | yes | `@NotBlank`, `@Email` |
| `password` | yes | `@NotBlank`, `@Size(min = 8, max = 128)` |
| `displayName` | no | `@Size(max = 100)` |

No password complexity rule exists server-side.
No uppercase, digit, or symbol is required.

### Observed

Valid request, including a dot in the username and a password with no uppercase and no digit:

```
POST /auth/register
{"username":"ctest.user1","email":"ctest.user1@example.com","password":"lowercaseonly","displayName":"C Test"}

201 {"success":true,"code":"CREATED","message":"Resource created successfully","data":null}
```

This single response disproves both frontend validation rules at once.

Violations:

```
{"username":"ab", ...}         400 VALIDATION_ERROR  {"username":"size must be between 3 and 30"}
{"username":"bad-name", ...}   400 VALIDATION_ERROR  {"username":"Username may only contain letters, digits, underscores and dots"}
{"password":"short12", ...}    400 VALIDATION_ERROR  {"password":"size must be between 8 and 128"}
{... ,"name":"X"}              400 MALFORMED_REQUEST_BODY
{... ,"confirmPassword":"..."} 400 MALFORMED_REQUEST_BODY
duplicate email                409 USER_ALREADY_EXISTS
duplicate username             409 USER_ALREADY_EXISTS
```

Note the last two unknown-field cases.
`name` and `confirmPassword` are both plausible things for a form to send.
Either one would have broken registration outright.

No tokens are issued on registration.
The user must verify their email before logging in.

---

## Login

`POST /auth/login`

| Field | Required | Rule |
|-------|----------|------|
| `identifier` | yes | `@NotBlank` only |
| `password` | yes | `@NotBlank` only |

The server resolves the account type by the presence of `@` in `identifier`.
There is no format rule and no length rule on either field.

### Observed

The exact body the frontend used to send:

```
{"email":"nobody@example.com","password":"Password1"}
400 {"success":false,"code":"MALFORMED_REQUEST_BODY","message":"Request body could not be read"}
```

The correct field name, with an email address:

```
{"identifier":"ctest.user1@example.com","password":"lowercaseonly"}
200 {"success":true,"code":"OK","data":{"accessToken":"eyJ...","refreshToken":"XIL8m18-...","accessTokenExpiresIn":900,"tokenType":"Bearer","user":{...}}}
```

The same endpoint, with a username instead:

```
{"identifier":"ctest.user1","password":"lowercaseonly"}
200 {"success":true,"code":"OK","data":{"accessToken":"eyJ...","refreshToken":"yXGIn7oL...","accessTokenExpiresIn":900,"tokenType":"Bearer","user":{...}}}
```

Both resolve to the same user id, `35c650e6-e881-4bde-9d24-dfc7dae8a293`.

Failures:

```
wrong password        401 AUTH_INVALID_CREDENTIALS   "Invalid email or password"
unverified account    403 AUTH_EMAIL_NOT_VERIFIED    "This account's email address has not been verified"
```

The unverified response is the one the frontend was reading incorrectly.
It looked for `errorCode`, a field the envelope does not have, and compared it against `EMAIL_NOT_VERIFIED` rather than `AUTH_EMAIL_NOT_VERIFIED`.
Both halves were wrong, so the branch could never be taken.

---

## Refresh

`POST /auth/refresh`

| Field | Required | Rule |
|-------|----------|------|
| `refreshToken` | yes | `@NotBlank` |

```
{"refreshToken":"nope"}
401 {"code":"AUTH_REFRESH_TOKEN_INVALID","message":"Invalid or revoked refresh token"}
```

---

## Logout

`POST /auth/logout`

Same request record as refresh: a single `refreshToken` field.
Returns `204 No Content` on success.

```
{"refreshToken":"nope"}
401 {"code":"UNAUTHORIZED","message":"Authentication is required"}
```

---

## Forgot password

`POST /auth/forgot-password`

| Field | Required | Rule |
|-------|----------|------|
| `email` | yes | `@NotBlank`, `@Email` |

Always returns `200` whether or not an account exists, to prevent account enumeration.

```
{"email":"ctest.user1@example.com"}
200 {"success":true,"code":"OK"}
```

---

## Reset password

`POST /auth/reset-password`

Annotated `@JsonIgnoreProperties(ignoreUnknown = false)`.

| Field | Required | Rule |
|-------|----------|------|
| `token` | yes | `@NotBlank` |
| `newPassword` | yes | `@NotBlank`, `@Size(min = 8, max = 128)` |

### Observed

The exact body the frontend used to send, which additionally carried `email`:

```
{"token":"abc","email":"a@b.com","newPassword":"password123"}
400 {"code":"MALFORMED_REQUEST_BODY","message":"Request body could not be read"}
```

The correct body:

```
{"token":"abc","newPassword":"password123"}
400 {"code":"AUTH_RESET_TOKEN_INVALID","message":"Invalid or expired reset token"}
```

The second response is still a `400`, but it is the endpoint rejecting a bad token rather than refusing to parse the body.
That difference is the whole point: the first form could never succeed with any token.

This mismatch was not listed in the task brief.
It was found by reading the request record and confirmed by experiment.

---

## Email verification

`GET /auth/verify-email?token=...`

A query parameter, not a request body.
The frontend was already calling this correctly.

```
GET /auth/verify-email?token=deadbeef
400 {"code":"AUTH_VERIFY_TOKEN_INVALID","message":"Email verification token is invalid or has expired"}
```

The token is an opaque one-time value delivered as a link in an email.
It is stored in Redis as a SHA-256 hash with a 24 hour TTL.
It is not a short numeric code.

---

## Resend verification

`POST /auth/verify-email/resend`

| Field | Required | Rule |
|-------|----------|------|
| `email` | yes | `@NotBlank`, `@Email` |

Always returns `200` to prevent account enumeration.

```
{"email":"ctest.user1@example.com"}
200 {"success":true,"code":"OK"}
```

---

## OAuth2 exchange

`POST /auth/oauth2/exchange`

| Field | Required | Rule |
|-------|----------|------|
| `code` | yes | `@NotBlank` |

```
{"code":"nope"}
400 {"code":"AUTH_OAUTH2_EXCHANGE_CODE_INVALID","message":"OAuth2 exchange code is invalid or has expired"}
```

The code is a short-lived opaque value with a 120 second TTL.

---

## Frontend forms: before and after

### Login form

| | Before | After |
|---|--------|-------|
| Form field name | `email` | `identifier` |
| Wire field name | `email` | `identifier` |
| Visible label | `username or email` | `username or email` (unchanged) |
| `autoComplete` | `email` | `username` |
| Password rule | `min(8)` | `min(1)` |
| Unverified handling | `data.errorCode === 'EMAIL_NOT_VERIFIED'` | `data.code === 'AUTH_EMAIL_NOT_VERIFIED'` |

The visible label already said "username or email", so the corrected contract required no copy change.
The `autoComplete` value moved from `email` to `username` because the field accepts both and `username` is the correct token for a dual identifier.

The password minimum dropped to 1 deliberately.
An account created under an older policy may hold a password shorter than the current minimum.
Blocking it in the login form would lock that user out of an account the server would still accept.
A length rule belongs on registration, not on login.

### Register form

| | Before | After |
|---|--------|-------|
| Inputs | username, display name, email, password | unchanged |
| Username pattern | `^[a-zA-Z0-9_]+$` | `^[a-zA-Z0-9_.]+$` |
| Password rules | `min(8)` + uppercase + digit | `min(8)` + `max(128)` |
| Copy case | mixed | lowercase |

No input was added or removed.
The form already collected everything the backend requires.

### Password rule change

This is the one change that makes the client accept more than it did before, so it is called out explicitly.

The backend enforces `@Size(min = 8, max = 128)` and nothing else.
The frontend additionally required an uppercase letter and a digit, and had no maximum.

The instruction for this phase was to follow the backend and adjust the frontend to match, so the complexity rules were removed and the missing maximum was added.
The client now accepts exactly what the server accepts.

The consequence is real and worth stating plainly.
`lowercaseonly` is now a valid password in the registration form, because it is a valid password to the server.
If a stronger policy is wanted, it belongs in the backend request record, where it will apply to every client rather than only to this one.

### Verification and reset schemas

`verifySchema` and `forgotPasswordResetSchema` validated a 6 to 12 character one-time code.
The backend has no such concept.
It issues opaque tokens delivered as links.

Both schemas were changed to validate the token for presence only, and the `otp` field was renamed to `token`.

Neither schema had a consumer at the time of the change.
Confirmed by searching the whole of `src/` for every exported schema name: only `loginSchema`, `authPageRegisterSchema`, `emailSchema`, and `resetPasswordSchema` are imported anywhere.
So no form was restructured and no screen changed.
The link-versus-code interaction design is recorded in `deferred-findings.md`.
