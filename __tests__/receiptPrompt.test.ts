/**
 * @jest-environment node
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_CATEGORIES } from '@/lib/categories';
import {
  buildReceiptPrompt,
  RECEIPT_PROMPT_TEMPLATE,
  RECEIPT_RESPONSE_SCHEMA,
} from '@/lib/receiptPrompt';

const spec = fs.readFileSync(path.join(__dirname, '..', 'docs', 'SPEC.md'), 'utf8');
const section5 = spec.slice(spec.indexOf('## 5. Gemini contract'), spec.indexOf('## 6.'));

/** The fenced code blocks in SPEC §5, in order: [prompt, responseSchema]. */
const fences = [...section5.matchAll(/```[a-z]*\n([\s\S]*?)\n```/g)].map((m) => m[1]!);

describe('SPEC §5 contract is mirrored exactly', () => {
  it('has the prompt and the responseSchema blocks', () => {
    expect(fences).toHaveLength(2);
  });

  it('prompt template matches the SPEC text', () => {
    expect(RECEIPT_PROMPT_TEMPLATE).toBe(fences[0]);
  });

  it('responseSchema matches the SPEC JSON', () => {
    expect(RECEIPT_RESPONSE_SCHEMA).toEqual(JSON.parse(fences[1]!));
  });
});

describe('buildReceiptPrompt', () => {
  it('fills in the category list, comma separated', () => {
    const prompt = buildReceiptPrompt(['Dairy & Eggs', 'Bakery', 'Other']);
    expect(prompt).toContain('Categories: Dairy & Eggs, Bakery, Other');
    expect(prompt).not.toContain('{CATEGORY_LIST}');
  });

  it('uses the default categories when none are given', () => {
    expect(buildReceiptPrompt()).toContain(`Categories: ${DEFAULT_CATEGORIES.join(', ')}`);
  });
});
