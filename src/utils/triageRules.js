/**
 * Triage rules shared by the LLM helper, urgency scorer and templates.
 *
 * Everything in this file is plain JavaScript with no dependencies, so it can be
 * unit tested with Node (see tests/triage.test.mjs) and reused as a fallback
 * when the Groq API is unavailable.
 */

export const CATEGORIES = [
  'Billing Issue',
  'Technical Problem',
  'Feature Request',
  'General Inquiry',
  'Positive Feedback',
]

export const MIN_MESSAGE_LENGTH = 10

/**
 * Keyword signals. Each entry is [regex, label]. Regexes use word boundaries so
 * that "add" doesn't match "address" and "down" doesn't match "download".
 */
const CRITICAL_SIGNALS = [
  [/\b(server|site|website|app|service|system|api|database|db)\b.{0,20}\b(down|offline|crashed|unreachable)\b/i, 'service outage'],
  [/\b(down|offline)\b.{0,15}\b(now|right now|again|for everyone|for all)\b/i, 'service outage'],
  [/\boutage\b/i, 'service outage'],
  [/\b(connection|database|db)\b.{0,15}\b(lost|failed|refused|timed? ?out)\b/i, 'connection failure'],
  [/\b(data loss|lost (all )?(my |our )?data|data (is )?(gone|deleted|missing))\b/i, 'data loss'],
  [/\b(security|breach|hacked|compromised|unauthori[sz]ed|phishing|leak(ed)?)\b/i, 'security concern'],
  [/\b(production|prod)\b.{0,20}\b(down|broken|error|issue|failing)\b/i, 'production issue'],
  [/\b(charged twice|double charged|duplicate charge|overcharged)\b/i, 'incorrect charge'],
]

const HIGH_SIGNALS = [
  [/\b(can'?t|cannot|unable to|locked out of|can not)\b.{0,20}\b(log ?in|sign ?in|access|use|open)\b/i, 'customer blocked'],
  [/\b(payment|card|transaction)\b.{0,15}\b(failed|declined|rejected)\b/i, 'payment failure'],
  [/\b(urgent|asap|emergency|immediately|critical)\b/i, 'customer says urgent'],
  [/\b(all|every|entire)\b.{0,15}\b(users?|customers?|team|orders?)\b.{0,25}\b(affected|down|broken|can'?t|cannot|error)\b/i, 'many users affected'],
  [/\b(losing|lost) (money|sales|revenue|customers)\b/i, 'business impact'],
]

const MEDIUM_SIGNALS = [
  [/\b(error|bug|broken|crash(es|ed|ing)?|not working|doesn'?t work|isn'?t working|fails?|failing|glitch)\b/i, 'something is broken'],
  [/\b(slow|lag(gy|ging)?|timeout|freez(e|es|ing))\b/i, 'performance problem'],
  [/\b(refund|charge[ds]?|invoice|billing|bill|subscription|cancel)\b/i, 'billing question'],
]

const LOW_SIGNALS = [
  [/\b(thank(s| you)|appreciate|love (it|your)|great job|awesome|helpful)\b/i, 'positive feedback'],
  [/\b(feature|would be (great|nice|useful)|could you add|please add|suggestion|would love|wish|enhancement)\b/i, 'feature request'],
]

function matchSignals(message, signals) {
  const labels = []
  for (const [regex, label] of signals) {
    if (regex.test(message) && !labels.includes(label)) labels.push(label)
  }
  return labels
}

/**
 * Explains the urgency of a message from what it says, not how it's written.
 *
 * The old scorer used punctuation, length, politeness and the time of day,
 * which marked "Server down now" as Low and a thank-you note full of "!" as High.
 *
 * @param {string} message
 * @param {string} [category]
 * @returns {{ level: 'High'|'Medium'|'Low', reasons: string[] }}
 */
export function assessUrgency(message, category) {
  const text = (message || '').trim()
  if (!text) return { level: 'Low', reasons: ['empty message'] }

  const critical = matchSignals(text, CRITICAL_SIGNALS)
  if (critical.length) return { level: 'High', reasons: critical }

  const high = matchSignals(text, HIGH_SIGNALS)
  if (high.length) return { level: 'High', reasons: high }

  const medium = matchSignals(text, MEDIUM_SIGNALS)
  if (medium.length) return { level: 'Medium', reasons: medium }

  const low = matchSignals(text, LOW_SIGNALS)
  if (low.length) return { level: 'Low', reasons: low }

  if (category === 'Technical Problem' || category === 'Billing Issue') {
    return { level: 'Medium', reasons: [`${category.toLowerCase()} with no severity details`] }
  }

  return { level: 'Low', reasons: ['no problem or time pressure described'] }
}

/**
 * Keyword categorization used when the LLM is unavailable or returns
 * something we can't use. Billing and technical signals can both be present
 * (e.g. "payment failed and I can't access the dashboard"); in that case the
 * account-access/billing cause wins so the message goes to the team that can
 * unblock the customer.
 */
export function categorizeByKeywords(message) {
  const text = (message || '').toLowerCase()

  const billing = /\b(bill(ing)?|payment|charged?|invoice|credit card|card|subscription|refund|pricing|plan|receipt)\b/.test(text)
  const technical = /\b(bug|error|broken|crash|down|not working|doesn'?t work|can'?t (log ?in|access|load)|cannot|loading|slow|server|database|connection|outage|login|log in)\b/.test(text)
  const feature = /\b(feature|could you add|please add|would be (great|nice|useful)|suggestion|would love|wish|enhancement|integrate|export)\b/.test(text)
  const praise = /\b(thank(s| you)|appreciate|love|great job|awesome|nice design|positive feedback)\b/.test(text)
  const question = /\?|^(how|what|when|where|why|can i|is there|do you)\b/.test(text)

  if (billing && technical) {
    return {
      category: 'Billing Issue',
      reasoning: 'Mentions both a billing problem and a technical symptom. The billing problem looks like the cause, so billing should handle it first and loop in technical support if the issue remains after payment is fixed.',
    }
  }
  if (billing) return { category: 'Billing Issue', reasoning: 'Mentions payments, charges, invoices or the subscription.' }
  if (technical) return { category: 'Technical Problem', reasoning: 'Describes an error, outage or something not working.' }
  if (feature) return { category: 'Feature Request', reasoning: 'Asks for new functionality or an improvement.' }
  if (praise && !question) return { category: 'Positive Feedback', reasoning: 'Shares thanks or positive feedback; no problem to solve.' }
  if (question) return { category: 'General Inquiry', reasoning: 'Asks a question without describing a problem.' }
  return { category: 'General Inquiry', reasoning: 'No clear category signals; a person should review it.' }
}

/** Maps free-form category text from the model onto one of CATEGORIES. */
export function normalizeCategory(raw) {
  if (!raw || typeof raw !== 'string') return null
  const value = raw.toLowerCase()
  const exact = CATEGORIES.find(c => c.toLowerCase() === value.trim())
  if (exact) return exact
  if (value.includes('billing') || value.includes('payment')) return 'Billing Issue'
  if (value.includes('technical') || value.includes('bug')) return 'Technical Problem'
  if (value.includes('feature')) return 'Feature Request'
  if (value.includes('positive') || value.includes('praise') || value.includes('feedback')) return 'Positive Feedback'
  if (value.includes('inquiry') || value.includes('question') || value.includes('general')) return 'General Inquiry'
  return null
}

/**
 * Parses the model's JSON reply. Returns null if it isn't usable so the caller
 * can fall back to keyword rules instead of guessing from free text.
 */
export function parseLLMResponse(content) {
  if (!content || typeof content !== 'string') return null
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const data = JSON.parse(match[0])
    const category = normalizeCategory(data.category)
    if (!category) return null
    const reasoning = typeof data.reasoning === 'string' && data.reasoning.trim()
      ? data.reasoning.trim()
      : 'No reasoning returned.'
    return { category, reasoning }
  } catch {
    return null
  }
}

/** Returns an error string if the message is too short to triage, else null. */
export function validateMessage(message) {
  const text = (message || '').trim()
  if (!text) return 'Please enter a customer message to analyze.'
  if (text.length < MIN_MESSAGE_LENGTH || text.split(/\s+/).length < 2) {
    return `This message is too short to triage reliably. Paste the full customer message (at least ${MIN_MESSAGE_LENGTH} characters).`
  }
  return null
}
