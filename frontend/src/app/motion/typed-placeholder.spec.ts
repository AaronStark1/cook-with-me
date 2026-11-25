import { typedFrames } from './typed-placeholder';

describe('typed placeholder', () => {
  it('types the word out, then deletes it again, always inside the same wrapper', () => {
    expect(typedFrames('Try “', 'Thai', '”')).toEqual([
      'Try “T”', 'Try “Th”', 'Try “Tha”', 'Try “Thai”', 'Try “Tha”', 'Try “Th”', 'Try “T”',
    ]);
  });

  it('handles a single letter and an empty word', () => {
    expect(typedFrames('', 'A')).toEqual(['A']);
    expect(typedFrames('Try ', '')).toEqual([]);
  });
});
