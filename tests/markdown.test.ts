import { describe, expect, it } from "vitest";
import { plainExcerpt, renderMarkdown } from "@/server/render/markdown";

describe("markdown rendering", () => {
  it("renders journal footnotes with numbered back-links and no arrow glyphs", () => {
    const html = renderMarkdown("A claim.[^1] Another.[^2]\n\n[^1]: *See* :sc[Cal. Educ. Code] § 66300.\n[^2]: Second note.");
    expect(html).toContain('<sup class="fn"><a href="#fn-1" id="fnref-1"');
    expect(html).toContain('<section class="notes" aria-labelledby="notes-heading"><h2 id="notes-heading">Notes</h2>');
    expect(html).toContain('<li id="fn-1"><a href="#fnref-1" class="note-number"');
    expect(html).toContain('<span class="sc">Cal. Educ. Code</span>');
    expect(html).not.toMatch(/↩|&#x21A9;/);
    expect(html).toContain('aria-describedby="notes-heading"');
    expect(html).not.toMatch(/ <\/p>/);
  });

  it("demotes top-level headings so the page keeps a single h1", () => {
    expect(renderMarkdown("# Heading")).toBe("<h2>Heading</h2>");
  });

  it.each([
    ["raw script tags", "<script>alert(1)</script>", /<script|alert\(1\)<\/script/],
    ["event handlers", '<img src=x onerror="alert(1)">', /onerror|<img/],
    ["javascript links", "[click](javascript:alert(1))", /javascript:/],
    ["data links", "[x](data:text/html;base64,PHNjcmlwdD4=)", /data:text/],
    ["vbscript links", "[x](vbscript:msgbox)", /vbscript:/],
    ["iframes", "<iframe src=https://evil.example></iframe>", /<iframe/],
    ["style attributes", '<p style="position:fixed">x</p>', /style=/],
  ])("strips %s", (_label, input, forbidden) => {
    expect(renderMarkdown(input)).not.toMatch(forbidden);
  });

  it("keeps safe links", () => {
    expect(renderMarkdown("[PCC](https://pasadena.edu) and [mail](mailto:a@b.org)")).toBe(
      '<p><a href="https://pasadena.edu">PCC</a> and <a href="mailto:a@b.org">mail</a></p>',
    );
  });

  it("renders unknown directives as literal text", () => {
    expect(renderMarkdown("Ratio :foo[bar] here")).toContain(":foo[bar]");
  });

  it("makes plain excerpts without markup or notes", () => {
    expect(plainExcerpt("A *claim*.[^1]\n\n[^1]: Note text.")).toBe("A claim.");
  });
});
