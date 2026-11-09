/**
 * Recommendation Templates - maps category + urgency to a recommended action
 */

const actionTemplates = {
  'Billing Issue': {
    High: 'Route to the billing team now. Check the account for failed or duplicate charges, restore access if a failed payment locked the customer out, and reply within 1 hour.',
    Medium: 'Route to the billing team. Confirm the charge or invoice in question and reply within 1 business day.',
    Low: 'Reply with the billing FAQ and a link to the billing portal; offer a follow-up if that does not answer it.',
  },
  'Technical Problem': {
    High: 'Escalate to on-call engineering now. Confirm scope (one customer or everyone), open an incident, and update the customer within 30 minutes.',
    Medium: 'Create a support ticket for technical support. Ask for steps to reproduce, browser/device and screenshots.',
    Low: 'Send the relevant help-center troubleshooting article and ask the customer to reply if it persists.',
  },
  'Feature Request': {
    High: 'Thank the customer and log the request for the product team; flag it because the customer describes a blocking need.',
    Medium: 'Thank the customer and log the request in the product feedback board with their use case.',
    Low: 'Thank the customer and log the request in the product feedback board with their use case.',
  },
  'General Inquiry': {
    High: 'Reply personally within 1 hour; the customer says it is time-sensitive.',
    Medium: 'Answer the question directly and include the matching FAQ link.',
    Low: 'Answer the question directly and include the matching FAQ link.',
  },
  'Positive Feedback': {
    High: 'Thank the customer personally and share the feedback with the team.',
    Medium: 'Thank the customer personally and share the feedback with the team.',
    Low: 'Thank the customer and share the feedback with the team. No support action needed.',
  },
  Unknown: {
    High: 'Review manually now.',
    Medium: 'Review manually.',
    Low: 'Review manually.',
  },
}

/**
 * Get recommended action for a given category and urgency
 *
 * @param {string} category - The message category
 * @param {string} [urgency] - High | Medium | Low (defaults to Medium)
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency = 'Medium') {
  const byUrgency = actionTemplates[category] || actionTemplates.Unknown
  return byUrgency[urgency] || byUrgency.Medium
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates).filter(c => c !== 'Unknown')
}

/**
 * Who owns each risk and what they should do first. These run alongside the
 * category action, because a churn threat inside a billing question still
 * needs the billing fix as well.
 */
const riskActions = {
  'data exposure': {
    owner: 'Security on-call',
    action: 'Treat it as a possible data leak: page security on-call now, keep the ticket private, and do not ask the customer to forward what they can see.',
  },
  'churn risk': {
    owner: 'Customer success',
    action: 'Bring in the account owner today, before the reply goes out, so the customer hears from someone who can fix the cause or offer options.',
  },
  'chargeback or legal threat': {
    owner: 'Billing lead',
    action: 'Send to the billing lead before replying. Stick to facts about the charge and do not argue or make promises in writing.',
  },
  'privacy request': {
    owner: 'Privacy / compliance',
    action: 'Forward to the privacy contact and log the request date: data requests have a legal response deadline.',
  },
}

/**
 * The owner and first action for each risk found in a message.
 *
 * @param {string[]} risks - Labels from detectRisks()
 * @returns {{risk: string, owner: string, action: string}[]}
 */
export function getRiskActions(risks = []) {
  return risks.filter(r => riskActions[r]).map(r => ({ risk: r, ...riskActions[r] }))
}

/**
 * Determines if message should be escalated to a human lead right away.
 * Previously this returned true for any message over 100 characters.
 * Any risk signal escalates, whatever the category.
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string[]} [risks] - Labels from detectRisks()
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency, risks = []) {
  if (risks.length) return true
  if (urgency !== 'High') return false
  return category === 'Technical Problem' || category === 'Billing Issue' || category === 'Unknown'
}
