# Customer Inbox Triage App

## Overview

The Customer Inbox Triage app is a lightweight AI-powered tool that helps classify customer support messages and recommend actions. It uses Groq AI to categorize messages, applies rule-based urgency scoring, and suggests next steps based on predefined templates.

## Problem Statement

Support teams waste time manually reading and triaging customer messages. This tool provides an automated first pass at classification to help prioritize and route messages more efficiently.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Groq API (Llama 3.3 70B - Free tier)
- **Runtime**: Browser-based (local development only)

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Groq API key (FREE - get from https://console.groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "L2 assessment"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Groq API Key**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Groq API key:
   ```
   VITE_GROQ_API_KEY=gsk_your-actual-key-here
   ```
   
   Get your FREE API key from: https://console.groq.com/keys
   
   **Why Groq?** Groq offers a generous free tier with fast inference and no credit card required!

4. **Run the application**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## How It Works

1. **Paste Message**: User pastes a customer support message into the text area
2. **Analyze**: Click "Analyze Message" to process the input
3. **Classification**: The app runs three processes in parallel:
   - **Category Classification** (LLM): Uses Groq AI (Llama 3.3 70B) to categorize the message
   - **Urgency Scoring** (Rule-based): Applies simple rules to determine urgency
   - **Recommendation** (Template-based): Maps category to a recommended action
4. **Display Results**: Shows category, urgency tag, recommended action, and AI reasoning
5. **History**: All analyses are saved to localStorage and viewable in the History tab


## Example Test Messages

Try analyzing these messages to see how the triage system works:

### Example 1: Production Issue
```
Our production server is down
```

### Example 2: Customer Feedback
```
Hi there! I just wanted to say thank you for your amazing customer service. I've been using your product for three years now and I'm really happy with it. Keep up the great work!
```

### Example 3: Feature Request
```
I would love to see a dark mode option in the app. It would be much easier on my eyes during night time usage.
```

### Example 4: Payment Issue
```
I tried to update my payment method but the page keeps loading forever. Is this a known issue?
```

### Example 5: Billing Question
```
Can I upgrade my subscription to the pro plan?
```

### Example 6: Technical Support
```
The dashboard won't load when I try to access it. I've tried refreshing but it keeps timing out.
```

## Security Note

⚠️ **Warning**: This application exposes the Groq API key in the browser (using `dangerouslyAllowBrowser: true`). This is acceptable for local development only but should **NEVER** be done in production. In a real application, API calls should be made from a secure backend server.

## Why Groq?

- ✅ **Completely Free** - No credit card required
- ✅ **Fast Inference** - Groq's LPU technology is incredibly fast
- ✅ **Generous Limits** - ~14,400 requests/day on free tier
- ✅ **High Quality** - Llama 3.3 70B performs excellently
- ✅ **Easy Signup** - Get started in minutes at https://console.groq.com

## License

This project is for educational purposes only.

## Improvements (Week 2 assessment — Ibtisam Hossain)

### How I tested the original app
I ran the 8 messages in `sample-messages.json` plus new examples through the triage logic (categorize → urgency → recommended action) and compared the results with what a support lead would expect.

### Top 3 areas for improvement
1. **Urgency scoring was backwards.** It scored how a message was written, not what it said: every `!` added +30, short messages lost 40–100 points, polite words, questions, weekends and after-hours all lowered urgency, and ALL CAPS *lowered* it. Result: "Database connection lost" and "Server down now" came out **Low**, while a thank-you note full of `!` came out **High**. For Relay AI this is the most costly flaw: real outages get buried and agents chase compliments.
2. **Categorization was unreliable.** The LLM got a one-line prompt with no category list, ran at temperature 0.7, and the app then searched the free-text answer for words like "billing" (so an answer that mentions billing in passing becomes a Billing Issue). The same message could get different categories on each run, and API failures silently fell back to mock answers with *random* reasoning text.
3. **Recommended actions and escalation were wrong or generic.** Feature Requests were told to "check the billing portal", every technical problem got "restart your browser" regardless of severity, urgency was ignored, and escalation was just "message longer than 100 characters". There was also no input validation ("hi" was triaged), and History sorted alphabetically instead of newest first.

### What I implemented
All three areas, with the biggest focus on #1 because routing depends on it:
- **New urgency rules** (`src/utils/triageRules.js`, `src/utils/urgencyScorer.js`): urgency comes from content signals — outages, connection failures, data loss, security, double charges (High); blocked customers, failed payments, "urgent" (High); errors, slowness, billing questions (Medium); thanks and feature ideas (Low). Punctuation, length, politeness and clock time no longer matter. The UI now shows *why* ("Why: service outage").
- **Deterministic, structured categorization** (`src/utils/llmHelper.js`): a system prompt with the exact categories and a rule for billing+technical overlaps, `temperature: 0`, JSON output, strict parsing into a fixed category list, and a clearly labeled keyword-rule fallback (no more random mock reasoning). Added a **Positive Feedback** category so praise isn't treated as a support ticket.
- **Category + urgency templates and real escalation** (`src/utils/templates.js`): each category has High/Medium/Low actions (e.g. High technical → on-call engineering, 30-minute update); escalation = High urgency on Technical/Billing issues, shown as a banner.
- **Input validation** (min 10 characters, 2+ words) and **History sorted newest first**.

### Results on the sample messages (urgency)
| # | Message | Before | After |
|---|---|---|---|
| 1 | Database connection lost | Low | **High** |
| 2 | Thank you so much! ... | Medium–High* | **Low** |
| 4 | My payment failed and now I can't access the dashboard... | Low | **High** (Billing) |
| 6 | Server down now | Low | **High** |
| 7 | Hi! ... positive feedback! (many `!`) | High | **Low** |
| 5 | hi | Low | **Rejected by validation** |

\*The old score also changed with the time of day and day of week.

### Tests
`npm test` runs `tests/triage.test.mjs` (Node's built-in test runner, no API key needed): 15 tests covering every sample message, new examples (double charge, hacked account, can't log in, slow page, invoice question, dark mode request, "download" vs "down"), templates, escalation and LLM JSON parsing.

### Still to do
- Move the Groq call to a small server/API route so the API key is never shipped to the browser (`dangerouslyAllowBrowser` is only acceptable for local development).
- Track agent overrides of category/urgency to measure accuracy over time.
- Dashboard "avg per day" assumes 7 days; compute it from the real date range.
