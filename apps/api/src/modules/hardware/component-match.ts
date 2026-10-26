/**
 * Matches a part name as a computer reports it ("12th Gen Intel(R) Core(TM)
 * i5-12400F 2.50 GHz", "NVIDIA GeForce RTX 4060 Laptop GPU") to a model in
 * our index ("Core i5-12400F", "GeForce RTX 4060 Laptop").
 */

/** Words that say nothing about which part it is. */
const NOISE = new Set(['intel', 'amd', 'nvidia', 'corporation', 'cpu', 'processor', 'gpu', 'graphics', 'with']);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\((?:r|tm)\)|®|™/g, ' ')
    // "Ryzen AI 9 HX 370 w/ Radeon 890M": the integrated graphics aren't the processor.
    .replace(/\s+(?:with|w\/)\s+radeon.*$/, ' ')
    .replace(/@?\s*\d+(?:[.,]\d+)?\s*ghz/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !NOISE.has(token));
}

/** The model number of an index entry: its longest token with a digit, not a memory size ("1060" in "GTX 1060 6GB"). */
function modelNumber(tokens: string[]): string | null {
  const numbered = tokens.filter((token) => /\d/.test(token) && !/^\d+gb$/.test(token));
  return numbered.reduce<string | null>((best, token) => (!best || token.length > best.length ? token : best), null);
}

export interface MatchCandidate {
  model: string;
  score: number;
}

/**
 * The entry whose model number appears in the name and whose other words fit
 * best: each shared word counts, each word the name lacks counts against
 * ("4060 Ti" loses to "4060" when the name has no "Ti"). Null when nothing fits.
 */
export function bestComponentMatch<T extends MatchCandidate>(name: string, candidates: T[]): T | null {
  const words = new Set(nameTokens(name));
  let best: { candidate: T; fit: number; extra: number } | null = null;
  for (const candidate of candidates) {
    const tokens = nameTokens(candidate.model);
    const number = modelNumber(tokens);
    if (!number || !words.has(number)) continue;
    const matched = tokens.filter((token) => words.has(token)).length;
    const extra = tokens.length - matched;
    const fit = matched * 2 - extra * 3;
    if (fit <= 0) continue;
    const better =
      !best || fit > best.fit || (fit === best.fit && (extra < best.extra || (extra === best.extra && candidate.score > best.candidate.score)));
    if (better) best = { candidate, fit, extra };
  }
  return best?.candidate ?? null;
}
