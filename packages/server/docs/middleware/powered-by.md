# ⚡ Powered By

Sets the `X-Powered-By` response header.

---

## 📥 Import

```ts
import { poweredBy } from "@rexeus/typeweaver-server";
```

## 🚀 Usage

```ts
const app = new TypeweaverApp().use(poweredBy()).route(new UserRouter({ requestHandlers }));
```

## ⚙️ Options

`PoweredByOptions`

- `name`: Value for the `X-Powered-By` header
  - Type: `string`
  - Default: `"TypeWeaver"`

## 💡 Examples

**Default**

```ts
app.use(poweredBy());
// X-Powered-By: TypeWeaver
```

**Custom value**

```ts
app.use(poweredBy({ name: "MyApp" }));
// X-Powered-By: MyApp
```

## 🎯 Scoped Usage

Set the header only on API routes with [`scoped`](scoped.md):

```ts
import { poweredBy, scoped } from "@rexeus/typeweaver-server";

app.use(scoped(["/api/*"], poweredBy()));
```

See [Scoped / Except](scoped.md) for pattern syntax and details.
