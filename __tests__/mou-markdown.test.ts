// utils/mou-markdown.ts: the vendor agreement is parsed completely. Nothing
// the server sends may be dropped, since the seller is agreeing to all of it.
import { parseInline, parseMouMarkdown, type Inline, type MouBlock } from '../utils/mou-markdown';

// Same constructs, in the same arrangement, as the web repo's lib/mou-content.ts.
const AGREEMENT = `# Vendor Memorandum of Understanding

**Version:** 1.0.0
**Date:** 5 March 2026
**Vendor:** Asha Rao (Vendor ID: 64f000000000000000000001)
**Shop:** Asha Handlooms

This MOU is entered into between **LinknSmile** ("Company") and the vendor identified above.

## 2. Commission Structure

The Company charges commission as a **flat rate on the entire order value**:

| Order Value | Commission Rate |
| --- | --- |
| ₹1 – ₹5,000 | 1% |
| ₹50,001 and above | 7% |

Example: an order worth ₹22,000 is charged at a flat 4%.

## 5. Vendor Obligations

The Vendor agrees to:

- Maintain accurate product listings;
- Not take any action to **circumvent** the Platform.

## 12. Acceptance

By checking the box and clicking "I Agree" below, Asha Rao confirms acceptance of this MOU.`;

const plain = (inline: Inline[]) => inline.map((run) => run.text).join('');

/** Every word of a parsed document, for checking nothing was lost. */
function allText(blocks: MouBlock[]): string {
  return blocks
    .flatMap((block) => {
      switch (block.type) {
        case 'heading':
          return [plain(block.text)];
        case 'paragraph':
          return block.lines.map(plain);
        case 'list':
          return block.items.map(plain);
        case 'table':
          return [...block.header, ...block.rows.flat()];
      }
    })
    .join(' ');
}

describe('parseInline', () => {
  it('splits bold runs from plain text', () => {
    expect(parseInline('a **flat rate** on **all** of it')).toEqual([
      { text: 'a ', bold: false },
      { text: 'flat rate', bold: true },
      { text: ' on ', bold: false },
      { text: 'all', bold: true },
      { text: ' of it', bold: false },
    ]);
  });

  it('leaves unmatched asterisks as they are', () => {
    expect(parseInline('5 * 3 ** 2')).toEqual([{ text: '5 * 3 ** 2', bold: false }]);
  });
});

describe('parseMouMarkdown', () => {
  const blocks = parseMouMarkdown(AGREEMENT);

  it('reads the document as headings, paragraphs, a table and a list, in order', () => {
    expect(blocks.map((block) => block.type)).toEqual([
      'heading', // title
      'paragraph', // version / date / vendor / shop
      'paragraph',
      'heading',
      'paragraph',
      'table',
      'paragraph',
      'heading',
      'paragraph',
      'list',
      'heading',
      'paragraph',
    ]);
  });

  it('tells the title from section headings', () => {
    expect(blocks[0]).toEqual({
      type: 'heading',
      level: 1,
      text: [{ text: 'Vendor Memorandum of Understanding', bold: false }],
    });
    expect(blocks[3]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('keeps the header facts on separate lines, labels in bold', () => {
    const header = blocks[1];
    if (header.type !== 'paragraph') throw new Error('expected a paragraph');
    expect(header.lines.map(plain)).toEqual([
      'Version: 1.0.0',
      'Date: 5 March 2026',
      'Vendor: Asha Rao (Vendor ID: 64f000000000000000000001)',
      'Shop: Asha Handlooms',
    ]);
    expect(header.lines[0][0]).toEqual({ text: 'Version:', bold: true });
  });

  it('reads the commission table without its separator row', () => {
    expect(blocks[5]).toEqual({
      type: 'table',
      header: ['Order Value', 'Commission Rate'],
      rows: [
        ['₹1 – ₹5,000', '1%'],
        ['₹50,001 and above', '7%'],
      ],
    });
  });

  it('reads the list of obligations, with bold inside an item', () => {
    const list = blocks[9];
    if (list.type !== 'list') throw new Error('expected a list');
    expect(list.items.map(plain)).toEqual([
      'Maintain accurate product listings;',
      'Not take any action to circumvent the Platform.',
    ]);
    expect(list.items[1]).toContainEqual({ text: 'circumvent', bold: true });
  });

  it('loses no text: every word of the source is in the result', () => {
    const sourceWords = AGREEMENT.replace(/\*\*/g, '') // bold markers sit inside words ("value**:")
      .replace(/^#+ |^- |\|/gm, ' ')
      .replace(/^[\s-]+$/gm, ' ') // the table's separator row
      .split(/\s+/)
      .filter(Boolean);
    expect(allText(blocks).split(/\s+/).filter(Boolean)).toEqual(sourceWords);
  });

  it('handles Windows line endings', () => {
    expect(parseMouMarkdown(AGREEMENT.replace(/\n/g, '\r\n'))).toEqual(blocks);
  });

  it('shows syntax it does not know as plain text instead of dropping it or hanging', () => {
    const parsed = parseMouMarkdown('#NoSpace heading\n1. numbered\n> quoted\n\n### Deep heading');
    expect(parsed).toEqual([
      { type: 'paragraph', lines: ['#NoSpace heading', '1. numbered', '> quoted'].map((text) => [{ text, bold: false }]) },
      { type: 'heading', level: 2, text: [{ text: 'Deep heading', bold: false }] },
    ]);
  });

  it('returns nothing for an empty document', () => {
    expect(parseMouMarkdown('')).toEqual([]);
    expect(parseMouMarkdown('\n\n  \n')).toEqual([]);
  });
});
