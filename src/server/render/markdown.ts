import type { Element, ElementContent, Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

/**
 * Markdown (CommonMark + GFM footnotes) to sanitized HTML for manuscripts, CMS pages and minutes.
 * Raw HTML in the source is never passed through. `:sc[text]` renders citation small caps.
 */

function remarkSmallCaps() {
  return (tree: MdastRoot) => {
    visit(tree, (node) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = node as any;
      if (n.type === "textDirective") {
        if (n.name === "sc") {
          n.data = { hName: "span", hProperties: { className: ["sc"] } };
        } else {
          // Unknown directives render as their literal text instead of disappearing.
          n.type = "text";
          n.value = `:${n.name}${n.children?.map((c: { value?: string }) => c.value ?? "").join("") ? `[${n.children.map((c: { value?: string }) => c.value ?? "").join("")}]` : ""}`;
          delete n.children;
        }
      } else if (n.type === "leafDirective" || n.type === "containerDirective") {
        n.data = { hName: "p" };
      }
    });
  };
}

/** Reshape GFM footnotes into the journal's notes: number links back, no arrow glyph. */
function rehypeJournalNotes() {
  return (tree: HastRoot) => {
    visit(tree, "element", (el: Element) => {
      if (el.tagName === "section" && el.properties?.dataFootnotes !== undefined) {
        el.properties = { className: ["notes"] };
        const ol = el.children.find((c): c is Element => c.type === "element" && c.tagName === "ol");
        const heading: Element = {
          type: "element",
          tagName: "h2",
          properties: { id: "notes-heading" },
          children: [{ type: "text", value: "Notes" }],
        };
        el.children = ol ? [heading, ol] : [heading];
        (el.properties as Record<string, unknown>).ariaLabelledBy = "notes-heading";
        if (!ol) return;
        let n = 0;
        ol.children.forEach((li) => {
          if (li.type !== "element" || li.tagName !== "li") return;
          n += 1;
          let backHref: string | undefined;
          visit(li, "element", (a: Element, i, parent) => {
            if (a.tagName === "a" && a.properties?.dataFootnoteBackref !== undefined && parent && typeof i === "number") {
              backHref = String(a.properties.href);
              const siblings = (parent as Element).children;
              siblings.splice(i, 1);
              const prev = siblings[i - 1];
              if (prev && prev.type === "text") prev.value = prev.value.replace(/\s+$/, "");
              return [SKIP, i];
            }
          });
          const number: Element = {
            type: "element",
            tagName: "a",
            properties: { href: backHref ?? "#", className: ["note-number"], ariaLabel: `Back to reference ${n}` },
            children: [{ type: "text", value: `${n}.` }],
          };
          li.children = [number, ...(li.children as ElementContent[])];
        });
      }
      // The page owns the h1; demote headings an author writes at the top level.
      if (el.tagName === "h1") el.tagName = "h2";
      if (el.tagName === "h5" || el.tagName === "h6") el.tagName = "h4";
      if (el.tagName === "a" && el.properties?.dataFootnoteRef !== undefined) {
        (el.properties as Record<string, unknown>).ariaDescribedBy = "notes-heading";
      }
      if (el.tagName === "sup") {
        el.properties = { ...el.properties, className: ["fn"] };
      }
    });
  };
}

const schema: SanitizeSchema = {
  ...defaultSchema,
  // Keep GFM's footnote ids distinct from page ids.
  clobberPrefix: "",
  tagNames: [
    "p", "h2", "h3", "h4", "em", "strong", "a", "blockquote", "ul", "ol", "li", "sup", "section",
    "span", "hr", "br", "code", "del",
  ],
  attributes: {
    a: ["href", "id", ["className", "note-number"], "ariaLabel", "ariaDescribedBy", "dataFootnoteRef", "dataFootnoteBackref"],
    span: [["className", "sc"]],
    section: [["className", "notes"], "ariaLabelledBy"],
    h2: ["id"],
    li: ["id"],
    sup: [["className", "fn"]],
    ol: ["start"],
  },
  protocols: { href: ["http", "https", "mailto"] },
  strip: ["script", "style"],
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkSmallCaps)
  .use(remarkRehype, {
    allowDangerousHtml: false,
    clobberPrefix: "",
    footnoteLabel: "Notes",
    footnoteBackContent: "",
  })
  .use(rehypeJournalNotes)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

export function renderMarkdown(source: string): string {
  return String(processor.processSync(source ?? ""));
}

/** Plain-text excerpt for indexes and emails (no markup, no notes). */
export function plainExcerpt(source: string, maxChars = 320): string {
  const text = (source ?? "")
    .replace(/\[\^[^\]]+\]:.*$/gm, "")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/:sc\[([^\]]*)\]/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
