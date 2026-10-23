/** Quick test: which vision model works via z-ai-web-dev-sdk? */
import ZAI from 'z-ai-web-dev-sdk'

// 1x1 red PNG
const RED_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function tryModel(zai, model) {
  try {
    const res = await zai.chat.completions.createVision({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this image? Answer in one word.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${RED_PNG}` } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
    const text = res?.choices?.[0]?.message?.content
    console.log(`MODEL ${model}: OK ->`, JSON.stringify(text)?.slice(0, 120))
    return true
  } catch (e) {
    console.log(`MODEL ${model}: FAIL ->`, (e.message || String(e)).slice(0, 140))
    return false
  }
}

async function main() {
  const zai = await ZAI.create()
  for (const m of ['glm-4.5v', 'glm-4v', 'glm-4v-flash', 'glm-4.6v']) {
    if (await tryModel(zai, m)) break
  }
}
main()
