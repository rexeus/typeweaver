import { describe, expect, test } from "vitest";
import { renderTemplate } from "../src/helpers/templateEngine.js";

describe("renderTemplate", () => {
  test("escapes HTML-sensitive characters in escaped interpolation", () => {
    const template = "<%= unsafe %>";

    const result = renderTemplate(template, {
      unsafe: `<tag attr="value">Tom & 'Jerry'</tag>`,
    });

    expect(result).toBe(
      "&lt;tag attr=&quot;value&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/tag&gt;"
    );
  });

  test("leaves raw interpolation unescaped", () => {
    const template = "<%- trustedHtml %>";

    const result = renderTemplate(template, {
      trustedHtml: `<strong>Ready & waiting</strong>`,
    });

    expect(result).toBe("<strong>Ready & waiting</strong>");
  });

  test("renders the true branch from control-flow blocks", () => {
    const template = [
      "<% if (enabled) { %>",
      "enabled:<%= label %>",
      "<% } else { %>",
      "disabled",
      "<% } %>",
    ].join("");

    const result = renderTemplate(template, {
      enabled: true,
      label: "notifications",
    });

    expect(result).toBe("enabled:notifications");
  });

  test("renders the else branch from control-flow blocks", () => {
    const template = [
      "<% if (enabled) { %>",
      "enabled",
      "<% } else { %>",
      "disabled:<%= label %>",
      "<% } %>",
    ].join("");

    const result = renderTemplate(template, {
      enabled: false,
      label: "notifications",
    });

    expect(result).toBe("disabled:notifications");
  });

  test("executes declarations inside control-flow blocks", () => {
    const template = [
      "<% const label = prefix.toUpperCase(); %>",
      "<%= label %>",
    ].join("");

    const result = renderTemplate(template, {
      prefix: "ready",
    });

    expect(result).toBe("READY");
  });

  test("iterates arrays inside control-flow blocks", () => {
    const template = [
      "<% for (const name of names) { %>",
      "<%= name %>;",
      "<% } %>",
    ].join("");

    const result = renderTemplate(template, {
      names: ["first", "second"],
    });

    expect(result).toBe("first;second;");
  });

  test("iterates object entries inside control-flow blocks", () => {
    const template = [
      "<% for (const [key, value] of Object.entries(record)) { %>",
      "<%= key %>=<%= value %>;",
      "<% } %>",
    ].join("");

    const result = renderTemplate(template, {
      record: {
        first: "alpha",
        second: "beta",
      },
    });

    expect(result).toBe("first=alpha;second=beta;");
  });

  test("renders nullish interpolated values as empty strings", () => {
    const template = "<%= undefinedValue %>|<%- nullValue %>|<%= present %>";

    const result = renderTemplate(template, {
      undefinedValue: undefined,
      nullValue: null,
      present: "done",
    });

    expect(result).toBe("||done");
  });

  test("renders falsy non-nullish interpolated values as strings", () => {
    const template = "<%= zero %>|<%= disabled %>|<%= empty %>";

    const result = renderTemplate(template, {
      zero: 0,
      disabled: false,
      empty: "",
    });

    expect(result).toBe("0|false|");
  });

  test("prefers colliding data properties over built-in identifiers", () => {
    const template = "<%= name %> | <%- toString %> | <%= constructor %>";

    const result = renderTemplate(template, {
      name: "Template Name",
      toString: "custom toString value",
      constructor: "custom constructor value",
    });

    expect(result).toBe(
      "Template Name | custom toString value | custom constructor value"
    );
  });

  test.each([
    {
      scenario: "nested property access",
      template: "<%= user.details.role %>",
      expected: "admin",
    },
    {
      scenario: "string method calls",
      template: "<%- user.name.toUpperCase() %>",
      expected: "ADA",
    },
    {
      scenario: "nested object method calls",
      template: '<%= user.details.hasOwnProperty("role") %>',
      expected: "true",
    },
    {
      scenario: "array method calls",
      template: '<%= labels.join(",") %>',
      expected: "one,two",
    },
  ])("preserves $scenario in templates", ({ template, expected }) => {
    const data = {
      user: {
        name: "Ada",
        details: {
          role: "admin",
        },
      },
      labels: ["one", "two"],
    };

    const result = renderTemplate(template, data);

    expect(result).toBe(expected);
  });

  test("preserves literal whitespace and newlines around template tags", () => {
    const template = "alpha \n  <%= value %>\n\t<%- raw %>  omega";

    const result = renderTemplate(template, {
      value: "beta",
      raw: "gamma",
    });

    expect(result).toBe("alpha \n  beta\n\tgamma  omega");
  });

  test("propagates template syntax errors instead of returning partial output", () => {
    const renderInvalidTemplate = () =>
      renderTemplate("<% if (enabled) { %>enabled", { enabled: true });

    expect(renderInvalidTemplate).toThrow(SyntaxError);
  });

  test("propagates runtime expression errors instead of returning partial output", () => {
    const renderInvalidExpression = () =>
      renderTemplate("before <%= user.name %> after", { user: null });

    expect(renderInvalidExpression).toThrow(TypeError);
  });
});
