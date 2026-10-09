export interface Chunk {
  id: string;
  lesson: string;
  heading: string;
  text: string;
}

const MAX_CHARS = 1500;

export function chunkLesson(lesson: string, markdown: string): Chunk[] {
  const sections: { heading: string; body: string[] }[] = [{ heading: "", body: [] }];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = inFence ? null : /^#{1,3}\s+(.*)$/.exec(line);
    if (heading) sections.push({ heading: heading[1].trim(), body: [] });
    else sections[sections.length - 1].body.push(line);
  }
  const chunks: Chunk[] = [];
  for (const { heading, body } of sections) {
    const text = body.join("\n").trim();
    if (!text) continue;
    for (const piece of pack(text)) {
      chunks.push({ id: `${lesson}#${chunks.length}`, lesson, heading: heading || lesson, text: piece });
    }
  }
  return chunks;
}

function pack(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const pieces: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length + 2 > MAX_CHARS) {
      pieces.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) pieces.push(current);
  return pieces;
}
