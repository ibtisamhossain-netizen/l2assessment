import Groq from 'groq-sdk';
import { CATEGORIES, categorizeByKeywords, parseLLMResponse } from './triageRules.js';

/**
 * LLM Helper for categorizing customer support messages
 * Using Groq API for AI-powered categorization
 */

// Only create a client when a key is configured, so the app still works
// (with keyword rules) without one.
const apiKey = import.meta.env.VITE_GROQ_API_KEY;
const hasApiKey = Boolean(apiKey && !apiKey.startsWith('your_'));

const groq = hasApiKey
  ? new Groq({
      apiKey,
      dangerouslyAllowBrowser: true // Local development only. In production, call Groq from a server so the key is never shipped to the browser.
    })
  : null;

const SYSTEM_PROMPT = `You triage customer support messages for Relay AI, a SaaS customer operations platform.
Classify the message into exactly one category:
- "Billing Issue": payments, charges, refunds, invoices, plans, subscriptions. If a billing problem causes an access problem, choose Billing Issue.
- "Technical Problem": errors, bugs, outages, login/access problems, slowness, anything not working.
- "Feature Request": asking for new functionality or an improvement.
- "General Inquiry": questions about the product, company or account that are not problems.
- "Positive Feedback": thanks or praise with no request.
Reply with JSON only, in this shape:
{"category": "<one of the categories above>", "reasoning": "<one or two sentences explaining the choice, citing words from the message>"}`;

/**
 * Categorize a customer support message using Groq AI
 *
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, reasoning: string, source: 'ai' | 'rules'}>}
 */
export async function categorizeMessage(message) {
  if (!groq) {
    return { ...categorizeByKeywords(message), source: 'rules' };
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      temperature: 0, // Same message -> same category
      response_format: { type: "json_object" },
    });

    const parsed = parseLLMResponse(response.choices[0]?.message?.content);
    if (parsed) {
      return { ...parsed, source: 'ai' };
    }
    console.warn('Groq returned an unusable category; using keyword rules instead.');
  } catch (error) {
    console.warn('Groq API failed; using keyword rules instead:', error.message);
  }

  return { ...categorizeByKeywords(message), source: 'rules' };
}

export { CATEGORIES };
