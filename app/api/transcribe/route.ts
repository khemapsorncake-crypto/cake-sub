import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type GroqSegment = {
  start?: number;
  end?: number;
  text?: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isLikelyHallucination(segment: GroqSegment, duration: number) {
  const text = normalizeText(segment.text);
  const compact = text.replace(/\s/g, "");
  const start = Number(segment.start ?? 0);
  const end = Number(segment.end ?? start);
  const noSpeech = Number(segment.no_speech_prob ?? 0);
  const avgLogProb = Number(segment.avg_logprob ?? 0);
  const compression = Number(segment.compression_ratio ?? 0);

  if (!text) return true;
  if (duration > 0 && (start > duration + 0.25 || end > duration + 1)) return true;
  if (end <= start) return true;
  if (noSpeech > 0.58) return true;
  if (avgLogProb < -1.15) return true;
  if (compression > 2.45) return true;
  if (/^(ขอบคุณที่รับชม|โปรดติดตามตอนต่อไป|ซับไตเติล|ดนตรี|เพลง|thank you for watching)[.!…]*$/i.test(text)) return true;
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

    const raw = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = raw ? JSON.parse(raw) : {};
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
      .filter((segment) => !isLikelyHallucination(segment, duration))
      .map((segment) => {
        const start = Math.max(0, Number(segment.start ?? 0));
        const rawEnd = Math.max(start + 0.35, Number(segment.end ?? start + 0.35));
        return {
          start,
          end: duration > 0 ? Math.min(duration, rawEnd) : rawEnd,
          text: normalizeText(segment.text),
        };
      })
      .filter((segment) => segment.text && segment.end > segment.start);

    if (!segments.length) {
      return NextResponse.json(
        { error: "ไม่พบเสียงพูดที่ชัดเจนพอ กรุณาลองคลิปที่เสียงพูดดังขึ้น" },
        { status: 422 },
      );
    }

    return NextResponse.json({ segments, duration });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" },
      { status: 500 },
    );
  }
}
