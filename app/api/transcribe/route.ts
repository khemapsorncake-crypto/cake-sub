import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type GroqSegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
};

function looksHallucinated(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const compact = clean.replace(/\s/g, "");
  if (!clean) return true;
  if (/^(ขอบคุณที่รับชม|โปรดติดตามตอนต่อไป|ซับไตเติล|ดนตรี|เพลง|thank you for watching)[.!…]*$/i.test(clean)) return true;
  if (/(.{2,12})\1\1/i.test(compact)) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY ใน Vercel" },
        { status: 500 },
      );
    }

    const incoming = await request.formData();
    const audio = incoming.get("audio");
    const duration = Number(incoming.get("duration") || 0);

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "ไม่พบไฟล์เสียง" }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", audio, "cake-sub.wav");
    form.append("model", "whisper-large-v3");
    form.append("language", "th");
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");
    form.append("timestamp_granularities[]", "segment");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      return NextResponse.json(
        { error: "บริการถอดเสียงตอบกลับไม่ถูกต้อง กรุณาลองใหม่" },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const apiError = data.error as { message?: string } | undefined;
      return NextResponse.json(
        { error: apiError?.message || "AI ถอดเสียงไม่สำเร็จ" },
        { status: response.status },
      );
    }

    const inputSegments = Array.isArray(data.segments)
      ? (data.segments as GroqSegment[])
      : [];

    const segments = inputSegments
      .filter((segment) => {
        const text = String(segment.text || "").trim();
        const start = Number(segment.start || 0);
        if (looksHallucinated(text)) return false;
        if (duration > 0 && start > duration + 0.5) return false;
        if (Number(segment.no_speech_prob || 0) > 0.72) return false;
        if (Number(segment.compression_ratio || 0) > 2.8) return false;
        return true;
      })
      .map((segment) => ({
        start: Math.max(0, Number(segment.start || 0)),
        end: Math.min(
          duration > 0 ? duration : Number.MAX_SAFE_INTEGER,
          Math.max(Number(segment.end || 0), Number(segment.start || 0) + 0.4),
        ),
        text: String(segment.text || "").replace(/\s+/g, " ").trim(),
      }));

    return NextResponse.json({
      text: segments.map((segment) => segment.text).join(" "),
      segments,
      duration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" },
      { status: 500 },
    );
  }
}
