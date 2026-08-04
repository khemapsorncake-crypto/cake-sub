import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    form.append(
      "prompt",
      "ถอดเสียงภาษาไทยตามที่ได้ยินจริง รักษาชื่อบุคคล ชื่อสถานที่ ราคา และคำภาษาอังกฤษ ไม่เติมคำที่ไม่มีในเสียง",
    );

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "AI ถอดเสียงไม่สำเร็จ" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" },
      { status: 500 },
    );
  }
}
