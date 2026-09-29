/**
 * Urgency Scorer - rule-based urgency calculation
 *
 * Urgency now comes from what the customer says (outages, data loss, security,
 * being blocked, failed payments, errors) instead of how they write it.
 * Punctuation, message length, politeness and the time of day no longer
 * change the score. See triageRules.js for the signal lists.
 */
import { assessUrgency } from './triageRules.js'

/**
 * @param {string} message - The customer message
 * @param {string} [category] - Category from the classifier, used as a tie-breaker
 * @returns {'High'|'Medium'|'Low'}
 */
export function calculateUrgency(message, category) {
  return assessUrgency(message, category).level
}

/**
 * Same as calculateUrgency, plus the reasons behind the level so agents can
 * see why a message was prioritized.
 */
export function explainUrgency(message, category) {
  return assessUrgency(message, category)
}
