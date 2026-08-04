import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type OpenAISegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า OPENAI_API_KEY ใน Vercel" },
        { status: 500 },
      );
    }

    const input = await request.formData();
    const file = input.get("file");
    const language = String(input.get("language") || "th");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ไม่พบไฟล์วิดีโอ" }, { status: 400 });
    }

    // Keep the first deploy simple and reliable on serverless hosting.
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "เวอร์ชันเริ่มต้นรองรับไฟล์ไม่เกิน 4 MB กรุณาตัดคลิปให้สั้นลงก่อน" },
        { status: 413 },
      );
    }

    const body = new FormData();
    body.append("file", file, file.name);
    body.append("model", "whisper-1");
    body.append("language", language);
    body.append("response_format", "verbose_json");
    body.append("timestamp_granularities[]", "segment");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || "AI ถอดเสียงไม่สำเร็จ";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const segments = ((result.segments || []) as OpenAISegment[])
      .map((segment, index) => ({
        id: String(segment.id ?? index + 1),
        start: Number(segment.start ?? 0),
        end: Number(segment.end ?? (segment.start ?? 0) + 2),
        text: String(segment.text || "").trim(),
      }))
      .filter((segment) => segment.text.length > 0);

    if (segments.length === 0 && result.text) {
      segments.push({ id: "1", start: 0, end: 4, text: String(result.text).trim() });
    }

    return NextResponse.json({ text: result.text || "", segments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
