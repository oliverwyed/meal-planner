#!/usr/bin/env node
// Estimates nutrition for every recipe in recipes.json and writes it back.
// Run: ANTHROPIC_API_KEY=sk-... node scripts/estimate-nutrition.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = join(__dir, '../src/data/recipes.json');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const CONCURRENCY = 3;

if (!API_KEY) {
  console.error('Set ANTHROPIC_API_KEY env var before running.');
  process.exit(1);
}

async function estimateNutrition(recipe) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: 'You are a nutritionist. Given recipe ingredients and serves, estimate the nutrition PER SERVING. Return ONLY valid JSON: { "calories": number, "protein": number, "carbs": number, "fat": number }. Round to nearest integer. Never return markdown.',
      messages: [{
        role: 'user',
        content: `Recipe: ${recipe.name}\nServes: ${recipe.serves}\nIngredients:\n${recipe.ingredients.join('\n')}\n\nEstimate nutrition per serving.`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]+\}/);
  if (!match) throw new Error(`No JSON in response: ${text}`);
  return JSON.parse(match[0]);
}

async function runWithConcurrency(items, fn, limit) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const recipes = JSON.parse(readFileSync(RECIPES_PATH, 'utf8'));
const toProcess = recipes.filter(r => !r.nutrition);

console.log(`${recipes.length} recipes total, ${toProcess.length} need nutrition data.\n`);

if (toProcess.length === 0) {
  console.log('All recipes already have nutrition data. Nothing to do.');
  process.exit(0);
}

let done = 0;

await runWithConcurrency(toProcess, async (recipe) => {
  try {
    const nutrition = await estimateNutrition(recipe);
    recipe.nutrition = nutrition;
    done++;
    process.stdout.write(`[${done}/${toProcess.length}] ${recipe.name} → ${nutrition.calories} cal, ${nutrition.protein}g protein\n`);
  } catch (err) {
    console.error(`  FAILED: ${recipe.name} — ${err.message}`);
  }
}, CONCURRENCY);

// Merge back into original array (preserving order)
const nameToNutrition = Object.fromEntries(toProcess.map(r => [r.name, r.nutrition]));
const updated = recipes.map(r => ({
  ...r,
  ...(nameToNutrition[r.name] ? { nutrition: nameToNutrition[r.name] } : {}),
}));

writeFileSync(RECIPES_PATH, JSON.stringify(updated, null, 2) + '\n');
console.log(`\nDone. ${done}/${toProcess.length} recipes updated. Saved to recipes.json.`);
