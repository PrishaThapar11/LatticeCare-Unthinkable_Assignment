const fallback = 'Summary generation pending - please contact your doctor\'s office.';
const GEMINI_MODEL = 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY;

async function callGemini(prompt: string, maxOutputTokens: number): Promise<string> {
  if (!apiKey) throw Error('AI unavailable');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens, responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw Error(`Gemini request failed: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw Error('Empty Gemini response');
  return text;
}

export async function preVisit(symptoms: string) {
  const prompt = `Analyse these symptoms and return JSON only: {"urgency":"Low|Medium|High","chiefComplaint":"string","suggestedQuestions":["string","string","string"]}. Symptoms: ${symptoms}`;
  try {
    const text = await callGemini(prompt, 500);
    const data = JSON.parse(text.replace(/```json|```/g, ''));
    return { urgency: data.urgency.toUpperCase(), chiefComplaint: data.chiefComplaint, suggestedQuestions: data.suggestedQuestions, retryRequired: false };
  } catch {
    return { urgency: 'MEDIUM', chiefComplaint: fallback, suggestedQuestions: ['What symptoms are most disruptive?', 'When did symptoms begin?', 'What makes them better or worse?'], retryRequired: true };
  }
}

export async function postVisit(notes: string) {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Return JSON only: {"summary":"string","followUpSteps":"string"}. Notes: ${notes}`;
  try {
    const text = await callGemini(prompt, 700);
    const data = JSON.parse(text.replace(/```json|```/g, ''));
    return { ...data, retryRequired: false };
  } catch {
    return { summary: fallback, followUpSteps: 'Your care team will share follow-up steps shortly.', retryRequired: true };
  }
}
