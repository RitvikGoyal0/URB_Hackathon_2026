import "server-only";
import { GoogleGenAI } from "@google/genai";
import { SCHEDULE_PROMPT, scheduleResponseJsonSchema, type Generate } from "./schedule";

/** True when the server has a Gemini key (the value is never exposed). */
export const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

/** Gemini vision call for the schedule parse; null when no key is configured. */
export function geminiScheduleGenerate(): Generate | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const ai = new GoogleGenAI({ apiKey });
  return async (model, image, signal) => {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: "List the classes in this schedule." }] }],
      config: { systemInstruction: SCHEDULE_PROMPT, responseMimeType: "application/json", responseJsonSchema: scheduleResponseJsonSchema, temperature: 0, abortSignal: signal },
    });
    return res.text;
  };
}
