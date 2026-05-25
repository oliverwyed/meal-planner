#!/usr/bin/env node
// Generates AI food-photography images for every recipe in recipes.json using
// DALL-E 3, uploads them to Supabase Storage, and writes the URLs back.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generate-recipe-images.mjs
//
// Options (env vars):
//   DELAY_MS=13000   Milliseconds between requests (default 13 s ≈ 4.6 req/min,
//                    safe for all OpenAI tiers). Set to 0 if you have a high-rate
//                    paid tier.
//   SKIP_EXISTING=1  Skip recipes that already have a Supabase-hosted photo URL.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const RECIPES_PATH = join(__dir, '../src/data/recipes.json');

// ── Config ────────────────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '13000', 10);
const SKIP_EXISTING = process.env.SKIP_EXISTING === '1';

// Load Supabase credentials from .env
const envRaw = readFileSync(join(__dir, '../.env'), 'utf8');
const envVars = Object.fromEntries(
  envRaw.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = envVars.VITE_SUPABASE_ANON_KEY;

if (!OPENAI_KEY) {
  console.error('\nError: set OPENAI_API_KEY before running.\n');
  process.exit(1);
}
if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
  console.error('\nError: VITE_SUPABASE_URL in .env is not set.\n');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildPrompt(recipe) {
  const cuisineHints = {
    italian:      'rustic Italian kitchen, ceramic plate',
    asian:        'minimalist Japanese styling, dark ceramic bowl',
    indian:       'warm spiced tones, copper or clay bowl',
    mexican:      'colourful Mexican earthenware, wooden board',
    american:     'casual diner styling, white plate',
    british:      'classic home-cooked, white plate on linen',
    middleeastern:'mezze-style, white plate with herbs scattered',
    other:        'neutral white plate, clean styling',
  };
  const hint = cuisineHints[recipe.cuisine] ?? cuisineHints.other;
  return (
    `Professional food photography of ${recipe.name}. ` +
    `${hint}. Natural window light, soft shadows, shallow depth of field. ` +
    `Appetising and beautifully plated. Overhead or slight 45-degree angle. ` +
    `No text, no watermarks, no people.`
  );
}

async function generateImage(recipe) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: buildPrompt(recipe),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }
  const { data } = await res.json();
  return data[0].b64_json; // base64-encoded PNG
}

async function uploadToSupabase(b64, filename) {
  const buffer = Buffer.from(b64, 'base64');
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/recipe-photos/${filename}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/recipe-photos/${filename}`;
}

function safeFilename(name) {
  return 'ai-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '.png';
}

function isSupabaseUrl(url) {
  return url && url.includes('/storage/v1/object/public/');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const recipes = JSON.parse(readFileSync(RECIPES_PATH, 'utf8'));

  const toProcess = SKIP_EXISTING
    ? recipes.filter(r => !isSupabaseUrl(r.photo))
    : recipes;

  const costEst = (toProcess.length * 0.04).toFixed(2);
  const timeEst = Math.ceil((toProcess.length * DELAY_MS) / 60000);

  console.log(`\n🍽️  Recipe image generator`);
  console.log(`   Recipes to process : ${toProcess.length} of ${recipes.length}`);
  console.log(`   Estimated cost     : ~$${costEst} (DALL-E 3 standard)`);
  console.log(`   Estimated time     : ~${timeEst} min at ${DELAY_MS / 1000}s/image`);
  if (SKIP_EXISTING) console.log(`   Skipping existing Supabase-hosted photos`);
  console.log();

  let updated = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if (SKIP_EXISTING && isSupabaseUrl(recipe.photo)) {
      process.stdout.write(`  skip  ${recipe.name}\n`);
      continue;
    }

    const tag = `[${updated + failed + 1}/${toProcess.length}]`;
    process.stdout.write(`  ${tag} ${recipe.name}… `);

    try {
      const b64 = await generateImage(recipe);
      const filename = safeFilename(recipe.name);
      const url = await uploadToSupabase(b64, filename);

      recipes[i] = { ...recipe, photo: url };
      writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2));

      console.log('✓');
      updated++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
      failures.push({ name: recipe.name, error: err.message });
      failed++;
    }

    if ((updated + failed) < toProcess.length && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done — ${updated} updated, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailed recipes:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.error}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
