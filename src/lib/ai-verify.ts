/**
 * AI verification engine (server-side only — uses z-ai-web-dev-sdk vision model).
 *
 * Two checks power the 3-step repair verification workflow:
 *  1. analyzeProofAuthenticity — detects morphed / manipulated proof photos
 *     uploaded by the maintenance team. A tampered verdict auto-rejects the
 *     work and issues a fine.
 *  2. matchRepairPhotos — cross-matches the reporter's confirmation photo
 *     against the maintenance team's proof photo to confirm the same fix.
 */
import ZAI from 'z-ai-web-dev-sdk'

const VISION_MODEL = 'glm-4.5v'

export type AuthenticityVerdict = 'AUTHENTIC' | 'MORPHED' | 'ERROR'
export type MatchVerdict = 'MATCHED' | 'MISMATCHED' | 'ERROR'

export type AuthenticityResult = {
  verdict: AuthenticityVerdict
  tamperScore: number // 0-100, higher = more likely manipulated
  note: string
}

export type MatchResult = {
  verdict: MatchVerdict
  score: number // 0-100 similarity
  note: string
}

/** Pull the first JSON object out of a model response (handles ```json fences). */
function extractJson<T>(text: string): T | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

const SYSTEM = 'You are a strict but fair digital image forensics auditor for a building maintenance system. Answer ONLY with the requested JSON — no markdown, no explanation outside the JSON.'

/**
 * Step 2 guard: is the maintenance team's proof photo genuine (an unedited
 * photo of the actual completed repair) or morphed / AI-generated / edited?
 * Tamper confidence >= 55 is treated as MORPHED.
 */
export async function analyzeProofAuthenticity(
  dataUrl: string,
  ctx: { code: string; title: string; zone: string; location?: string | null; priority?: string },
): Promise<AuthenticityResult> {
  try {
    const zai = await ZAI.create()
    const res = await zai.chat.completions.createVision({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `A maintenance staff member uploaded this photo as PROOF of completed repair work.\n` +
                `Repair report: ${ctx.code} — "${ctx.title}" at ${ctx.zone}${ctx.location ? ` (${ctx.location})` : ''}.\n\n` +
                `Audit the image for digital manipulation / morphing, checking:\n` +
                `1. AI-generation artifacts (over-smooth textures, warped text, impossible geometry)\n` +
                `2. Splicing / cloning / inpainting seams around objects\n` +
                `3. Inconsistent lighting direction, shadows or reflections\n` +
                `4. Mismatched perspective, scale or colour grading between regions\n` +
                `5. Whether the scene plausibly depicts the described repair being finished\n\n` +
                `Respond ONLY with JSON exactly like: {"tampered": <true|false>, "confidence": <0-100 number = certainty that the image IS manipulated>, "reason": "<one sentence>"}`,
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const text: string = res?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson<{ tampered?: boolean; confidence?: number; reason?: string }>(text)
    if (!parsed || typeof parsed.confidence !== 'number') {
      // Model answered but not parseable — treat as manual-review (ERROR keeps flow moving)
      return { verdict: 'ERROR', tamperScore: 0, note: 'AI response could not be parsed — flagged for manual admin review.' }
    }
    const tamperScore = Math.max(0, Math.min(100, Math.round(parsed.confidence)))
    const verdict: AuthenticityVerdict = parsed.tampered === true && tamperScore >= 55 ? 'MORPHED' : 'AUTHENTIC'
    return { verdict, tamperScore, note: parsed.reason?.slice(0, 500) ?? '' }
  } catch (e) {
    return { verdict: 'ERROR', tamperScore: 0, note: `AI check failed (${(e as Error).message.slice(0, 120)}) — flagged for manual admin review.` }
  }
}

/**
 * Step 3 guard: does the reporter's confirmation photo show the SAME repair
 * / location as the maintenance team's proof photo? Similarity >= 60 = MATCHED.
 */
export async function matchRepairPhotos(
  proofDataUrl: string,
  confirmDataUrl: string,
  ctx: { code: string; title: string; zone: string },
): Promise<MatchResult> {
  try {
    const zai = await ZAI.create()
    const res = await zai.chat.completions.createVision({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Two photos are attached for repair verification of report ${ctx.code} — "${ctx.title}" at ${ctx.zone}.\n` +
                `IMAGE 1 = proof photo uploaded by the maintenance team after finishing the work.\n` +
                `IMAGE 2 = confirmation photo uploaded by the person who reported the fault.\n\n` +
                `Decide whether both photos plausibly show the SAME repair, the SAME asset/fixture and the SAME location ` +
                `(same room features, materials, fittings, wall/floor style, fix state). Angle and lighting may differ.\n\n` +
                `Respond ONLY with JSON exactly like: {"matched": <true|false>, "confidence": <0-100 number = similarity certainty>, "reason": "<one sentence>"}`,
            },
            { type: 'image_url', image_url: { url: proofDataUrl } },
            { type: 'image_url', image_url: { url: confirmDataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const text: string = res?.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson<{ matched?: boolean; confidence?: number; reason?: string }>(text)
    if (!parsed || typeof parsed.confidence !== 'number') {
      return { verdict: 'ERROR', score: 0, note: 'AI response could not be parsed — flagged for manual admin review.' }
    }
    const score = Math.max(0, Math.min(100, Math.round(parsed.confidence)))
    const verdict: MatchVerdict = parsed.matched === true && score >= 60 ? 'MATCHED' : 'MISMATCHED'
    return { verdict, score, note: parsed.reason?.slice(0, 500) ?? '' }
  } catch (e) {
    return { verdict: 'ERROR', score: 0, note: `AI check failed (${(e as Error).message.slice(0, 120)}) — flagged for manual admin review.` }
  }
}

/** Fine amount (INR) scaled by report priority. */
export function fineAmountFor(priority: string): number {
  switch (priority) {
    case 'URGENT': return 5000
    case 'HIGH': return 2000
    case 'MEDIUM': return 1000
    default: return 500
  }
}
