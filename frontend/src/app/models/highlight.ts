export interface TextPart { text: string; hit: boolean }

/** Split `text` around case-insensitive matches of `key`, for `<mark>` highlighting. */
export function highlightParts(text: string | null | undefined, key: string | null | undefined): TextPart[] {
  const source = text ?? '';
  const needle = (key ?? '').trim().toLowerCase();
  if (!source || !needle) return source ? [{ text: source, hit: false }] : [];
  const haystack = source.toLowerCase();
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: source.slice(from, at), hit: false });
    parts.push({ text: source.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  if (from < source.length) parts.push({ text: source.slice(from), hit: false });
  return parts;
}
