import type { ReactNode } from "react";

export function MarkdownReport({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  const content: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const classes = level === 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-base";
      content.push(<div key={index} className={`mb-2 mt-6 font-bold ${classes}`}>{inline(heading[2] ?? "")}</div>);
      index += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const table: string[][] = [];
      while (index < lines.length && (lines[index]?.trim() ?? "").startsWith("|")) {
        const cells = (lines[index] ?? "").split("|").slice(1, -1).map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) table.push(cells);
        index += 1;
      }
      content.push(<div key={`table-${index}`} className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><tbody>{table.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "bg-slate-100 font-semibold" : ""}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border px-3 py-2">{inline(cell)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]?.trim() ?? "")) {
        items.push((lines[index]?.trim() ?? "").replace(/^[-*]\s+/, ""));
        index += 1;
      }
      content.push(<ul key={`list-${index}`} className="my-3 list-disc space-y-1 pl-6">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>);
      continue;
    }
    content.push(<p key={index} className="my-3 leading-7">{inline(line)}</p>);
    index += 1;
  }

  return <article className="markdown-report text-sm text-slate-800">{content}</article>;
}

function inline(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const position = match.index ?? 0;
    if (position > cursor) result.push(value.slice(cursor, position));
    if (match[2] && match[3]) result.push(<a key={position} className="text-blue-700 underline" href={match[3]} target="_blank" rel="noreferrer">{match[2]}</a>);
    else if (match[4]) result.push(<strong key={position}>{match[4]}</strong>);
    else if (match[5]) result.push(<code key={position} className="rounded bg-slate-100 px-1 py-0.5 text-xs">{match[5]}</code>);
    cursor = position + match[0].length;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}
