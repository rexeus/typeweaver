# 📋 Logger

Request/response logging with timing. Logs after the response is produced, capturing the final
status code and duration.

---

## 📥 Import

```ts
import { logger } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp().use(logger()).route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`LoggerOptions`

- `logFn`: Output function for the formatted log line
  - Type: `(message: string) => void`
  - Default: `console.log`
- `format`: Formats `LogData` into the string passed to `logFn`
  - Type: `(data: LogData) => string`
  - Default: `` `${method} ${path} ${statusCode} ${durationMs}ms` ``

**`LogData`**

```ts
type LogData = {
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
};
```

## 💡 Examples

**Default** — logs to stdout in the format `GET /users 200 3ms`

```ts
app.use(logger());
```

**Custom format**

```ts
app.use(
  logger({
    format: data =>
      `[${new Date().toISOString()}] ${data.method} ${data.path} -> ${data.statusCode} (${data.durationMs}ms)`,
  })
);
```

**Custom log function**

```ts
app.use(
  logger({
    logFn: msg => pino.info(msg),
  })
);
```

## 🎯 Scoped Usage

Skip logging on health-check endpoints with [`except`](scoped.md):

```ts
import { logger, except } from "@rexeus/typeweaver-server";

app.use(except(["/health", "/ready"], logger()));
```

See [Scoped / Except](scoped.md) for pattern syntax and details.
