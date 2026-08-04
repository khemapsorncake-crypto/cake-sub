"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Play, Sparkles, Trash2, Upload } from "lucide-react";

type Subtitle = { id: string; start: number; end: number; text: string };
type Segment = { start?: number; end?: number; text?: string };

function clock(value: number) {
  const minutes = Math.floor(value / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function srtTime(value: number) {
  const safe = Math.max(0, value || 0);
  const hours = Math.floor(safe / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  const milliseconds = Math.round((safe % 1) * 1000).toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

async function videoToWav(file: File): Promise<Blob> {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("เบราว์เซอร์นี้อ่านเสียงจากวิดีโอไม่ได้");

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData((await file.arrayBuffer()).slice(0));
    if (decoded.duration > 130) {
      throw new Error("เวอร์ชัน Vercel รองรับคลิปไม่เกินประมาณ 2 นาที 10 วินาทีต่อครั้ง");
    }

    const sampleRate = 16000;
    const length = Math.ceil(decoded.duration * sampleRate);
    const offline = new OfflineAudioContext(1, length, sampleRate);
    const source = offline.createBufferSource();
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const channel = mono.getChannelData(0);

    for (let c = 0; c < decoded.numberOfChannels; c += 1) {
      const input = decoded.getChannelData(c);
      for (let i = 0; i < input.length; i += 1) channel[i] += input[i] / decoded.numberOfChannels;
    }

    source.buffer = mono;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const write = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (const sample of samples) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const active = useMemo(() => subtitles.find((s) => currentTime >= s.start && currentTime < s.end), [currentTime, subtitles]);

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("video/")) return setError("กรุณาเลือกไฟล์วิดีโอ");
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(selected);
    urlRef.current = url;
    setFile(selected); setVideoUrl(url); setSubtitles([]); setError(""); setProgress(0); setStatus("");
  }

  async function generate() {
    if (!file || status) return;
    try {
      setError(""); setStatus("กำลังแยกเสียงจากคลิป"); setProgress(15);
      const wav = await videoToWav(file);
      setStatus("กำลังส่งเสียงไปให้ Whisper Large V3"); setProgress(45);
      const form = new FormData(); form.append("audio", wav, "cake-sub.wav");
      const timer = window.setInterval(() => setProgress((p) => Math.min(92, p + 2)), 700);
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      window.clearInterval(timer);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "สร้างซับไม่สำเร็จ");
      setProgress(96); setStatus("กำลังจัดช่วงเวลา");
      const segments: Segment[] = Array.isArray(data.segments) ? data.segments : [];
      const next = segments
        .map((segment, index) => ({
          id: `${Date.now()}-${index}`,
          start: Number(segment.start || 0),
          end: Math.max(Number(segment.end || 0), Number(segment.start || 0) + 0.5),
          text: String(segment.text || "").trim(),
        }))
        .filter((item) => item.text);
      if (!next.length && data.text) next.push({ id: `${Date.now()}-0`, start: 0, end: 5, text: data.text.trim() });
      setSubtitles(next); setProgress(100); setStatus("");
    } catch (caught) {
      setStatus(""); setProgress(0); setError(caught instanceof Error ? caught.message : "สร้างซับไม่สำเร็จ");
    }
  }

  function downloadSrt() {
    const body = subtitles.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${file?.name.replace(/\.[^.]+$/, "") || "cake-sub"}.srt`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="brand"><span className="brand-icon">🍰</span><div><h1>Cake Sub</h1><p>AI ทำซับอัตโนมัติ ไม่มีลายน้ำ</p></div></div>
        <input ref={inputRef} type="file" accept="video/*" hidden onChange={selectVideo} />
        {!file ? (
          <button className="upload-box" onClick={() => inputRef.current?.click()}><Upload size={28}/><strong>เลือกวิดีโอ</strong><span>MP4 หรือ MOV</span></button>
        ) : (
          <div className="workspace">
            <div className="video-panel">
              <div className="video-frame">
                <video ref={videoRef} src={videoUrl} controls onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
                {active && <div className="subtitle-preview">{active.text}</div>}
              </div>
              <div className="file-row"><span>{file.name}</span><button className="ghost-button" onClick={() => inputRef.current?.click()}>เปลี่ยนคลิป</button></div>
              <button className="primary-button" disabled={Boolean(status)} onClick={generate}>{status ? <LoaderCircle className="spin"/> : <Sparkles/>}{status || "AI สร้างซับ"}</button>
              {status && <div className="progress-wrap"><div className="progress-track"><div className="progress-fill" style={{width:`${progress}%`}}/></div><span>{progress}%</span></div>}
              {error && <div className="error-box">{error}</div>}
            </div>
            <div className="editor-panel">
              <div className="panel-title"><div><h2>ข้อความซับ</h2><p>{subtitles.length ? `${subtitles.length} ช่วง` : "กด AI สร้างซับก่อน"}</p></div>{subtitles.length > 0 && <button className="download-button" onClick={downloadSrt}><Download size={18}/>ดาวน์โหลด SRT</button>}</div>
              <div className="subtitle-list">
                {subtitles.length === 0 ? <div className="empty-state"><Sparkles size={30}/><p>ซับที่ AI สร้างจะปรากฏตรงนี้</p></div> : subtitles.map((subtitle) => (
                  <div className="subtitle-card" key={subtitle.id}>
                    <button className="play-button" onClick={() => { if(videoRef.current){videoRef.current.currentTime=subtitle.start; void videoRef.current.play();}}}><Play size={16}/></button>
                    <div className="subtitle-fields"><div className="time-row"><label>เริ่ม<input type="number" step="0.1" value={subtitle.start} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,start:Number(e.target.value)}:s))}/></label><label>จบ<input type="number" step="0.1" value={subtitle.end} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,end:Number(e.target.value)}:s))}/></label><span>{clock(subtitle.start)}</span></div><textarea value={subtitle.text} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,text:e.target.value}:s))}/></div>
                    <button className="delete-button" onClick={()=>setSubtitles((all)=>all.filter((s)=>s.id!==subtitle.id))}><Trash2 size={17}/></button>
                  </div>
                ))}
              </div>
              {subtitles.length > 0 && <div className="success-row"><CheckCircle2 size={18}/>แก้คำได้ก่อนดาวน์โหลด</div>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
