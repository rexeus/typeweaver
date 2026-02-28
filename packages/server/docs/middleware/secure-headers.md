# 🛡️ Secure Headers

Applies OWASP-recommended security headers to every response. Each header can be customized or
disabled individually.

---

## 📥 Import

```ts
import { secureHeaders } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp().use(secureHeaders()).route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`SecureHeadersOptions`

Every option accepts a `string` to override the default value, or `false` to remove the header
entirely.

| Option                         | HTTP Header                         | Default                                 |
| ------------------------------ | ----------------------------------- | --------------------------------------- |
| `contentTypeOptions`           | `X-Content-Type-Options`            | `"nosniff"`                             |
| `frameOptions`                 | `X-Frame-Options`                   | `"SAMEORIGIN"`                          |
| `strictTransportSecurity`      | `Strict-Transport-Security`         | `"max-age=15552000; includeSubDomains"` |
| `referrerPolicy`               | `Referrer-Policy`                   | `"no-referrer"`                         |
| `xssProtection`                | `X-XSS-Protection`                  | `"0"`                                   |
| `downloadOptions`              | `X-Download-Options`                | `"noopen"`                              |
| `dnsPrefetchControl`           | `X-DNS-Prefetch-Control`            | `"off"`                                 |
| `permittedCrossDomainPolicies` | `X-Permitted-Cross-Domain-Policies` | `"none"`                                |
| `crossOriginResourcePolicy`    | `Cross-Origin-Resource-Policy`      | `"same-origin"`                         |
| `crossOriginOpenerPolicy`      | `Cross-Origin-Opener-Policy`        | `"same-origin"`                         |
| `crossOriginEmbedderPolicy`    | `Cross-Origin-Embedder-Policy`      | `"require-corp"`                        |
| `originAgentCluster`           | `Origin-Agent-Cluster`              | `"?1"`                                  |

## 💡 Examples

**Defaults** — applies all 12 headers

```ts
app.use(secureHeaders());
```

**Disable a specific header**

```ts
app.use(
  secureHeaders({
    crossOriginEmbedderPolicy: false,
  })
);
```

**Custom HSTS**

```ts
app.use(
  secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
  })
);
```

**Minimal set**

```ts
app.use(
  secureHeaders({
    frameOptions: false,
    downloadOptions: false,
    dnsPrefetchControl: false,
    permittedCrossDomainPolicies: false,
    originAgentCluster: false,
  })
);
```

## 🎯 Scoped Usage

Apply security headers only on API routes with [`scoped`](scoped.md):

```ts
import { secureHeaders, scoped } from "@rexeus/typeweaver-server";

app.use(scoped(["/api/*"], secureHeaders({ strictTransportSecurity: "max-age=31536000" })));
```

See [Scoped / Except](scoped.md) for pattern syntax and details.
