import { highlightParts } from './highlight';

describe('highlightParts', () => {
  it('marks every case-insensitive match and keeps the original casing', () => {
    expect(highlightParts('Pasta alla pasta', 'pas')).toEqual([
      { text: 'Pas', hit: true }, { text: 'ta alla ', hit: false }, { text: 'pas', hit: true }, { text: 'ta', hit: false },
    ]);
  });

  it('returns the whole text unmarked without a key or a match', () => {
    expect(highlightParts('Pad Thai', '')).toEqual([{ text: 'Pad Thai', hit: false }]);
    expect(highlightParts('Pad Thai', '   ')).toEqual([{ text: 'Pad Thai', hit: false }]);
    expect(highlightParts('Pad Thai', 'zzz')).toEqual([{ text: 'Pad Thai', hit: false }]);
  });

  it('is safe with missing text and never loses characters', () => {
    expect(highlightParts(undefined, 'a')).toEqual([]);
    expect(highlightParts('Garlic Naan', ' NAAN ').map((p) => p.text).join('')).toBe('Garlic Naan');
  });
});
