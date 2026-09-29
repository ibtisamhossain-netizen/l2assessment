// Run with: npm test   (or: node --test tests/*.test.mjs)
// Tests the rule-based parts of triage against the repo's sample messages plus
// new examples. No API key or network needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assessUrgency, categorizeByKeywords, parseLLMResponse, normalizeCategory, validateMessage,
} from '../src/utils/triageRules.js'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction, shouldEscalate } from '../src/utils/templates.js'

const samples = JSON.parse(readFileSync(new URL('../sample-messages.json', import.meta.url))).testMessages
const byId = id => samples.find(s => s.id === id).message

// Expected results for the sample messages that shipped with the repo.
const expected = [
  { id: 1, category: 'Technical Problem', urgency: 'High' },   // Database connection lost
  { id: 2, category: 'Positive Feedback', urgency: 'Low' },    // Thank you so much!...
  { id: 3, category: 'Feature Request', urgency: 'Low' },      // Export to CSV
  { id: 4, category: 'Billing Issue', urgency: 'High' },       // Payment failed + can't access
  { id: 6, category: 'Technical Problem', urgency: 'High' },   // Server down now
  { id: 7, category: 'Positive Feedback', urgency: 'Low' },    // Long rambling praise with "!"
  { id: 8, category: 'General Inquiry', urgency: 'Low' },      // Business hours
]

for (const e of expected) {
  test(`sample #${e.id}: ${e.category} / ${e.urgency}`, () => {
    const msg = byId(e.id)
    const { category } = categorizeByKeywords(msg)
    assert.equal(category, e.category)
    assert.equal(calculateUrgency(msg, category), e.urgency)
  })
}

test('sample #5 ("hi") is rejected by validation', () => {
  assert.ok(validateMessage(byId(5)))
  assert.equal(validateMessage('My invoice total looks wrong this month'), null)
})

test('urgency ignores punctuation, length, politeness and time of day', () => {
  assert.equal(calculateUrgency('Great job!!!!!!!!'), 'Low')
  assert.equal(calculateUrgency('PLEASE HELP, OUR PRODUCTION SITE IS DOWN'), 'High')
  assert.equal(calculateUrgency('Hi, thank you for your help. Our database connection lost again this morning, could you please look?'), 'High')
})

test('new examples: urgency levels', () => {
  assert.equal(calculateUrgency('I was charged twice for my subscription this month'), 'High')
  assert.equal(calculateUrgency('I think my account was hacked, there are logins I do not recognize'), 'High')
  assert.equal(calculateUrgency('I cannot log in since this morning'), 'High')
  assert.equal(calculateUrgency('The reports page is really slow to load'), 'Medium')
  assert.equal(calculateUrgency('Can I get a copy of my last invoice?'), 'Medium')
  assert.equal(calculateUrgency('Would be great if you added dark mode'), 'Low')
  assert.equal(calculateUrgency('I want to download my data as a PDF'), 'Low') // "download" is not "down"
})

test('urgency reasons are reported', () => {
  const { reasons } = assessUrgency('Server down now')
  assert.ok(reasons.includes('service outage'))
})

test('templates: feature requests no longer get the billing portal answer', () => {
  const action = getRecommendedAction('Feature Request', 'Low')
  assert.ok(!/billing/i.test(action))
  assert.match(action, /product/i)
})

test('templates: action depends on urgency', () => {
  assert.notEqual(getRecommendedAction('Technical Problem', 'High'), getRecommendedAction('Technical Problem', 'Low'))
  assert.match(getRecommendedAction('Technical Problem', 'High'), /on-call/i)
  assert.ok(getRecommendedAction('Something Else', 'Low'))
})

test('escalation depends on urgency and category, not message length', () => {
  assert.equal(shouldEscalate('Technical Problem', 'High'), true)
  assert.equal(shouldEscalate('Billing Issue', 'High'), true)
  assert.equal(shouldEscalate('Positive Feedback', 'Low'), false)
  assert.equal(shouldEscalate('General Inquiry', 'Medium'), false)
})

test('LLM JSON parsing and category normalization', () => {
  assert.deepEqual(
    parseLLMResponse('{"category":"Technical Problem","reasoning":"Server is down."}'),
    { category: 'Technical Problem', reasoning: 'Server is down.' },
  )
  assert.equal(parseLLMResponse('Here you go: {"category": "billing", "reasoning": "card"}').category, 'Billing Issue')
  assert.equal(parseLLMResponse('This is a technical issue about billing'), null) // not JSON -> fall back to rules
  assert.equal(parseLLMResponse('{"category":"Spam"}'), null)
  assert.equal(normalizeCategory('feature request'), 'Feature Request')
})
