import { describe, expect, test } from "vitest";
import { renderTemplate } from "../src/helpers/templateEngine.js";

describe("renderTemplate", () => {
  test("renders escaped and raw expressions", () => {
    const template = "<%= unsafe %> | <%- unsafe %>";
    const result = renderTemplate(template, {
      unsafe: '<tag attr="value">&</tag>',
    });

    expect(result).toBe(
      '&lt;tag attr=&quot;value&quot;&gt;&amp;&lt;/tag&gt; | <tag attr="value">&</tag>'
    );
  });

  test("supports control flow, declarations, and expressions", () => {
    const template = [
      "<% const names = values.filter(Boolean); %>",
      "<% if (names.length > 0) { %>",
      "<% for (const name of names) { %><%= prefix %><%- name.toUpperCase() %>; <% } %>",
      "<% } %>",
    ].join("\n");

    const result = renderTemplate(template, {
      prefix: "item:",
      values: ["first", "", "second"],
    });

    expect(result).toContain("item:FIRST;");
    expect(result).toContain("item:SECOND;");
  });

  test("supports Object.entries() iteration inside templates", () => {
    const template = [
      "<% for (const [key, value] of Object.entries(record)) { %>",
      "<%= key %>=<%= value %>;",
      "<% } %>",
    ].join("\n");

    const result = renderTemplate(template, {
      record: {
        first: "alpha",
        second: "beta",
      },
    });

    expect(result).toContain("first=alpha;");
    expect(result).toContain("second=beta;");
  });

  test("preserves data-property access and method calls within with(data) scope", () => {
    const template = [
      "<%= user.name %>",
      "<%- user.name.toUpperCase() %>",
      '<%= user.details.hasOwnProperty("role") %>',
      '<%= labels.join(",") %>',
    ].join(" | ");

    const result = renderTemplate(template, {
      user: {
        name: "Ada",
        details: {
          role: "admin",
        },
      },
      labels: ["one", "two"],
    });

    expect(result).toBe("Ada | ADA | true | one,two");
  });

  test("renders undefined and null values as empty strings", () => {
    const template = "<%= missing %>|<%- value %>|<%= nullable %>";
    const result = renderTemplate(template, {
      missing: undefined,
      value: null,
      nullable: "done",
    });

    expect(result).toBe("||done");
  });

  test("prefers colliding data properties over built-in identifiers", () => {
    const template = "<%= name %> | <%- toString %>";
    const result = renderTemplate(template, {
      name: "Template Name",
      toString: "custom toString value",
    });

    expect(result).toBe("Template Name | custom toString value");
  });
});
