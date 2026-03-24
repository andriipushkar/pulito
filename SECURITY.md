# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**DO NOT** create a public GitHub issue for security vulnerabilities.

### How to report

Email: **andriipushkar@gmail.com**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** within 48 hours
- **Initial assessment:** within 5 business days
- **Fix or mitigation:** depends on severity, typically within 14 days for critical issues

### What qualifies

- Authentication/authorization bypass
- SQL injection, XSS, CSRF
- Sensitive data exposure
- Server-side request forgery (SSRF)
- Remote code execution
- Privilege escalation

### What does NOT qualify

- Rate limiting thresholds (by design)
- Missing security headers on non-production environments
- Vulnerabilities in dependencies without a working exploit
- Social engineering attacks

## Security measures in place

- JWT RS256 with token rotation and reuse detection
- Rate limiting: Redis sliding window (global + per-route)
- CSRF protection (Origin + X-Requested-With validation)
- XSS prevention (DOMPurify sanitization)
- 12 security headers: CSP with nonce, HSTS, COEP, COOP
- Idempotency keys for order operations
- Cookie consent (3 categories), GDPR compliance
- Input validation with Zod on all API endpoints
- Timing-safe token comparison
- File upload validation (magic bytes + size limits)
