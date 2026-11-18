import type { Task } from "../types";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function stripHtml(html: string): string {
  if (typeof window === "undefined") return html || "";
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Find all unique tasks mentioned in a note's HTML content or plain text.
 */
export function getMentionedTasks(content: string, tasks: Task[]): Task[] {
  if (!content || !tasks || tasks.length === 0) return [];

  const foundIds = new Set<string>();

  // 1. From href="#task-..."
  const hrefMatches = content.matchAll(/href=["']#task-([^"'\\s>]+)["']/gi);
  for (const m of hrefMatches) {
    if (m[1]) foundIds.add(m[1].toLowerCase());
  }

  // 2. From data-task-id="..."
  const dataMatches = content.matchAll(/data-task-id=["']([^"'\\s>]+)["']/gi);
  for (const m of dataMatches) {
    if (m[1]) foundIds.add(m[1].toLowerCase());
  }

  // 3. From text mentions: @TASK-xxx or @[0-9]+
  const textMatches = content.matchAll(/@([A-Za-z0-9_-]+)/g);
  for (const m of textMatches) {
    if (m[1]) foundIds.add(m[1].toLowerCase());
  }

  if (foundIds.size === 0) return [];

  // Match tasks by ID or numeric ID
  const matched: Task[] = [];
  const seenIds = new Set<string>();

  for (const task of tasks) {
    const id = String(task.id).toLowerCase();
    const cleanId = id.replace(/^task-/, "");

    const isMatch =
      foundIds.has(id) ||
      foundIds.has(cleanId) ||
      foundIds.has(`task-${id}`) ||
      foundIds.has(`task-${cleanId}`);

    if (isMatch && !seenIds.has(id)) {
      seenIds.add(id);
      matched.push(task);
    }
  }

  return matched;
}

function cleanTrailingUrlPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = "";

  while (/[.,;:!?)]$/.test(url)) {
    // If it ends with ')' and contains '(', keep it unless '(' is balanced
    if (url.endsWith(")") && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) {
      break;
    }
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

/**
 * Format note HTML content for View Mode:
 * 1. Transform all <a> links:
 *    - Links pointing to tasks (#task-xxx or data-task-id) become interactive task mention chips.
 *    - External web links get target="_blank", rel="noopener noreferrer", proper styling, and open in new tab.
 * 2. In text nodes (not inside existing <a>, <pre>, <code>):
 *    - Plain text URLs (http://, https://, www.) are converted into clickable links with target="_blank".
 *    - Plain text task mentions (@TASK-xxx) matching user tasks are converted into task mention chips.
 */
export function formatNoteContentForView(html: string, tasks: Task[]): string {
  if (typeof window === "undefined" || !html) return html || "";

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Map tasks for quick lookup
    const taskMap = new Map<string, Task>();
    tasks.forEach((t) => {
      const id = String(t.id).toLowerCase();
      taskMap.set(id, t);
      taskMap.set(id.replace(/^task-/, ""), t);
      taskMap.set(`task-${id.replace(/^task-/, "")}`, t);
    });

    // 1. Process all existing <a> tags
    const anchors = Array.from(doc.querySelectorAll("a"));
    anchors.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const taskAttr = a.getAttribute("data-task-id");

      let taskId = taskAttr;
      if (!taskId && href.startsWith("#task-")) {
        taskId = href.replace(/^#task-/, "");
      }

      if (taskId) {
        // It's a task mention!
        const matchedTask = taskMap.get(taskId.toLowerCase());
        const displayId = matchedTask ? matchedTask.id : taskId;
        const displayTitle = matchedTask ? matchedTask.title : "";

        a.setAttribute("href", `#task-${displayId}`);
        a.setAttribute("data-task-id", String(displayId));
        a.setAttribute(
          "title",
          displayTitle ? `Klik untuk melihat detail task: ${displayTitle}` : `Task ${displayId}`,
        );
        a.className =
          "task-mention-chip inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors cursor-pointer select-none no-underline my-0.5 align-baseline";

        a.innerHTML = `<span class="opacity-70 shrink-0">📋</span><span class="font-mono shrink-0">@${escapeHtml(String(displayId))}</span>${
          displayTitle
            ? `<span class="font-normal text-zinc-600 dark:text-zinc-400 truncate">· ${escapeHtml(displayTitle)}</span>`
            : ""
        }`;
      } else {
        // External link
        let formattedUrl = href.trim();
        if (
          !/^https?:\/\//i.test(formattedUrl) &&
          !formattedUrl.startsWith("mailto:") &&
          !formattedUrl.startsWith("#")
        ) {
          formattedUrl = `https://${formattedUrl}`;
        }

        a.setAttribute("href", formattedUrl);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.className =
          "external-link text-violet-600 dark:text-violet-400 font-medium underline hover:text-violet-700 dark:hover:text-violet-300 cursor-pointer inline-flex items-baseline gap-0.5";
      }
    });

    // 2. Process text nodes outside <a>, <pre>, <code> for plain URLs and task mentions
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === "a" || tag === "pre" || tag === "code" || tag === "script" || tag === "style") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodesToReplace: { textNode: Text; fragment: DocumentFragment }[] = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
      const textNode = currentNode as Text;
      const text = textNode.nodeValue || "";

      // Regex to match URLs or @TASK mentions
      const combinedRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+|@[A-Za-z0-9_-]+)/g;

      if (combinedRegex.test(text)) {
        combinedRegex.lastIndex = 0;
        const fragment = doc.createDocumentFragment();
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = combinedRegex.exec(text)) !== null) {
          const matchStart = match.index;
          const matchText = match[0];

          // Append text before match
          if (matchStart > lastIndex) {
            fragment.appendChild(doc.createTextNode(text.slice(lastIndex, matchStart)));
          }

          if (matchText.startsWith("@")) {
            // Check if it's a valid task mention
            const rawId = matchText.slice(1);
            const matchedTask = taskMap.get(rawId.toLowerCase());

            if (matchedTask) {
              const link = doc.createElement("a");
              link.setAttribute("href", `#task-${matchedTask.id}`);
              link.setAttribute("data-task-id", String(matchedTask.id));
              link.setAttribute("title", `Klik untuk melihat detail task: ${matchedTask.title}`);
              link.className =
                "task-mention-chip inline-flex max-w-full items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors cursor-pointer select-none no-underline my-0.5 align-baseline";
              link.innerHTML = `<span class="opacity-70 shrink-0">📋</span><span class="font-mono shrink-0">@${escapeHtml(String(matchedTask.id))}</span><span class="font-normal text-zinc-600 dark:text-zinc-400 truncate">· ${escapeHtml(matchedTask.title)}</span>`;
              fragment.appendChild(link);
            } else {
              fragment.appendChild(doc.createTextNode(matchText));
            }
            lastIndex = matchStart + matchText.length;
          } else {
            // It's a URL
            const { url, trailing } = cleanTrailingUrlPunctuation(matchText);
            const fullHref = /^https?:\/\//i.test(url) ? url : `https://${url}`;

            const link = doc.createElement("a");
            link.setAttribute("href", fullHref);
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
            link.className =
              "external-link text-violet-600 dark:text-violet-400 font-medium underline hover:text-violet-700 dark:hover:text-violet-300 cursor-pointer inline-flex items-baseline gap-0.5";
            link.textContent = url;
            fragment.appendChild(link);

            if (trailing) {
              fragment.appendChild(doc.createTextNode(trailing));
            }

            lastIndex = matchStart + matchText.length;
          }
        }

        if (lastIndex < text.length) {
          fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
        }

        nodesToReplace.push({ textNode, fragment });
      }

      currentNode = walker.nextNode();
    }

    // Apply replacements
    for (const item of nodesToReplace) {
      item.textNode.parentNode?.replaceChild(item.fragment, item.textNode);
    }

    return doc.body.innerHTML;
  } catch (err) {
    console.error("formatNoteContentForView error:", err);
    return html;
  }
}
