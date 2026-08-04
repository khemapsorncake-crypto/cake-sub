"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Film,
  LoaderCircle,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

type Subtitle = { id: string; start: number; end: number; text: string };
type Segment = { start?: number; end?: number; text?: string };
type CaptureVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

function clock(value: number) {
  const safe = Math.max(0, Number(value) || 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function srtTime(value: number) {
  const safe = Math.max(0, Number(value) || 0);
  const hours = Math.floor(safe / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  const milliseconds = Math.round((safe % 1) * 1000).toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function videoToWav(file: File): Promise<{ blob: Blob; duration: number }> {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("เบราว์เซอร์นี้อ่านเสียงจากวิดีโอไม่ได้");

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData((await file.arrayBuffer()).slice(0));
    if (decoded.duration > 130) {
      throw new Error("รองรับคลิปไม่เกินประมาณ 2 นาที 10 วินาทีต่อครั้ง");
    }

    const sampleRate = 16_000;
    const length = Math.ceil(decoded.duration * sampleRate);
    const offline = new OfflineAudioContext(1, length, sampleRate);
    const source = offline.createBufferSource();
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const channel = mono.getChannelData(0);

    for (let c = 0; c < decoded.numberOfChannels; c += 1) {
      const input = decoded.getChannelData(c);
      for (let i = 0; i < input.length; i += 1) {
        channel[i] += input[i] / decoded.numberOfChannels;
      }
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

    return { blob: new Blob([buffer], { type: "audio/wav" }), duration: decoded.duration };
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
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(34);
  const [textColor, setTextColor] = useState("#ffffff");
  const [strokeColor, setStrokeColor] = useState("#111111");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [subtitlePosition, setSubtitlePosition] = useState(78);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const active = useMemo(
    () => subtitles.find((s) => currentTime >= s.start && currentTime < s.end),
    [currentTime, subtitles],
  );

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("video/")) {
      setError("กรุณาเลือกไฟล์วิดีโอ MP4 หรือ MOV");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(selected);
    urlRef.current = url;
    setFile(selected);
    setVideoUrl(url);
    setSubtitles([]);
    setError("");
    setProgress(0);
    setStatus("");
    setRenderProgress(0);
  }

  async function generate() {
    if (!file || status) return;
    let timer = 0;
    try {
      setError("");
      setStatus("กำลังอ่านเสียงทั้งคลิป");
      setProgress(12);
      const { blob, duration } = await videoToWav(file);

      setStatus("AI กำลังถอดเสียงตามที่ได้ยิน");
      setProgress(38);
      const form = new FormData();
      form.append("audio", blob, "cake-sub.wav");
      form.append("duration", String(duration));

      timer = window.setInterval(() => setProgress((p) => Math.min(91, p + 1)), 900);
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      window.clearInterval(timer);

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();
      if (!contentType.includes("application/json")) {
        throw new Error("API ยังไม่พร้อมใช้งาน กรุณาตรวจ Deployment ล่าสุดของ Vercel");
      }
      const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) throw new Error(data.error || "สร้างซับไม่สำเร็จ");

      setProgress(96);
      setStatus("กำลังจัดช่วงเวลา");
      const segments: Segment[] = Array.isArray(data.segments) ? data.segments : [];
      const next = segments
        .map((segment, index) => ({
          id: `${Date.now()}-${index}`,
          start: Math.max(0, Number(segment.start || 0)),
          end: Math.max(Number(segment.end || 0), Number(segment.start || 0) + 0.35),
          text: String(segment.text || "").trim(),
        }))
        .filter((item) => item.text);

      if (!next.length) throw new Error("AI ไม่พบเสียงพูดที่ชัดเจนในคลิปนี้");
      setSubtitles(next);
      setProgress(100);
      setStatus("");
    } catch (caught) {
      if (timer) window.clearInterval(timer);
      setStatus("");
      setProgress(0);
      setError(caught instanceof Error ? caught.message : "สร้างซับไม่สำเร็จ");
    }
  }

  function downloadSrt() {
    const body = subtitles
      .map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`)
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file?.name.replace(/\.[^.]+$/, "") || "cake-sub"}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function renderVideo() {
    const video = videoRef.current as CaptureVideo | null;
    if (!video || !file || !subtitles.length || rendering) return;
    if (!video.captureStream || typeof MediaRecorder === "undefined") {
      setError("การสร้างวิดีโอต้องเปิดด้วย Chrome หรือ Edge บนคอม");
      return;
    }

    setError("");
    setRendering(true);
    setRenderProgress(0);
    const originalTime = video.currentTime;
    const originalMuted = video.muted;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการสร้างวิดีโอ");

      video.currentTime = 0;
      video.muted = false;
      const sourceStream = video.captureStream();
      const canvasStream = canvas.captureStream(30);
      const output = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...sourceStream.getAudioTracks(),
      ]);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

      await new Promise<void>((resolve, reject) => {
        recorder.onerror = () => reject(new Error("สร้างวิดีโอไม่สำเร็จ"));
        recorder.onstop = () => resolve();
        recorder.start(1000);
        void video.play();

        const draw = () => {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const subtitle = subtitles.find((s) => video.currentTime >= s.start && video.currentTime < s.end);
          if (subtitle) {
            const renderFontSize = Math.max(18, Math.round((fontSize / 390) * canvas.width));
            context.font = `900 ${renderFontSize}px "${fontFamily}", Arial, sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.lineJoin = "round";
            context.lineWidth = Math.max(1, (strokeWidth / 390) * canvas.width);
            context.strokeStyle = strokeColor;
            context.fillStyle = textColor;
            const lines = wrapText(context, subtitle.text, canvas.width * 0.82);
            const lineHeight = renderFontSize * 1.22;
            const baseY = canvas.height * (subtitlePosition / 100) - ((lines.length - 1) * lineHeight) / 2;
            lines.forEach((line, index) => {
              const y = baseY + index * lineHeight;
              context.strokeText(line, canvas.width / 2, y);
              context.fillText(line, canvas.width / 2, y);
            });
          }
          setRenderProgress(Math.min(99, Math.round((video.currentTime / Math.max(video.duration, 1)) * 100)));
          if (!video.ended && recorder.state === "recording") requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
        video.onended = () => { if (recorder.state === "recording") recorder.stop(); };
      });

      const result = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(result);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.[^.]+$/, "")}-cake-sub.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setRenderProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "สร้างวิดีโอไม่สำเร็จ");
    } finally {
      video.pause();
      video.currentTime = originalTime;
      video.muted = originalMuted;
      setRendering(false);
    }
  }

  return (
    <main>
      <header>
        <div className="brand"><div className="logo">🍰</div><div><h1>Cake Sub</h1><p>ทำซับอัตโนมัติ ไม่มีลายน้ำ</p></div></div>
        <span className="free-badge">ใช้งานส่วนตัว</span>
      </header>

      <section className="hero">
        <span className="pill"><Sparkles size={15}/> AI Subtitle</span>
        <h2>อัปโหลดคลิป แล้วให้ AI ทำซับให้</h2>
        <p>ถอดเสียงตามที่ได้ยินจริง แก้ข้อความได้ และสร้างวิดีโอพร้อมซับจากหน้าเดียว</p>
        <input ref={inputRef} type="file" accept="video/*" hidden onChange={selectVideo}/>
        <button className="primary" onClick={() => inputRef.current?.click()}><Upload size={19}/>{file ? "เปลี่ยนวิดีโอ" : "เลือกวิดีโอ"}</button>
        {file && <div className="filename"><Film size={15}/><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></div>}
      </section>

      <section className="workspace">
        <div className="video-column">
          <div className="phone-frame">
            {videoUrl ? (
              <><video ref={videoRef} src={videoUrl} controls onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}/>{active && <div className="subtitle-preview" style={{fontFamily: `"${fontFamily}", Arial, sans-serif`, fontSize: `${fontSize}px`, color: textColor, WebkitTextStroke: `${Math.max(0, strokeWidth / 2)}px ${strokeColor}`, bottom: `${100 - subtitlePosition}%`}}>{active.text}</div>}</>
            ) : (
              <div className="empty-video"><Video size={38}/><b>ยังไม่ได้เลือกคลิป</b><span>รองรับ MP4 และ MOV</span></div>
            )}
          </div>
          <button className="ai-button" disabled={!file || Boolean(status)} onClick={generate}>{status ? <LoaderCircle className="spin"/> : <Sparkles/>}{status || "AI สร้างซับ"}</button>
          {status && <div className="progress-card"><div className="progress-head"><b>{status}</b><span>{progress}%</span></div><div className="progress-track"><div style={{width:`${progress}%`}}/></div><p>AI จะไม่เติมข้อความ fallback หากช่วงใดฟังไม่ชัด</p></div>}
          {error && <div className="error-box">{error}</div>}
          {subtitles.length > 0 && <div className="success-box"><CheckCircle2 size={18}/>สร้างซับแล้ว {subtitles.length} ช่วง</div>}
        </div>

        <div className="panel">
          <div className="section-title"><div><h3>ข้อความซับ</h3><p>กดเล่นแต่ละช่วงเพื่อตรวจและแก้คำ</p></div><span>{subtitles.length} ช่วง</span></div>
          <div className="style-panel">
            <div className="style-panel-head"><div><b>รูปแบบซับ</b><span>พรีวิวเปลี่ยนทันที</span></div><button type="button" className="reset-style" onClick={() => { setFontFamily("Arial"); setFontSize(34); setTextColor("#ffffff"); setStrokeColor("#111111"); setStrokeWidth(5); setSubtitlePosition(78); }}>คืนค่าเริ่มต้น</button></div>
            <div className="style-grid">
              <label>ฟอนต์<select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}><option value="Arial">Arial</option><option value="Tahoma">Tahoma</option><option value="Leelawadee UI">Leelawadee UI</option><option value="Noto Sans Thai">Noto Sans Thai</option><option value="sans-serif">Sans Serif</option></select></label>
              <label>ขนาด <span>{fontSize}px</span><input type="range" min="20" max="64" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}/></label>
              <label>สีตัวอักษร<input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)}/></label>
              <label>สีขอบ<input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}/></label>
              <label>ความหนาขอบ <span>{strokeWidth}px</span><input type="range" min="0" max="12" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))}/></label>
              <label>ตำแหน่ง <span>{subtitlePosition}%</span><input type="range" min="55" max="90" value={subtitlePosition} onChange={(e) => setSubtitlePosition(Number(e.target.value))}/></label>
            </div>
          </div>
          {subtitles.length === 0 ? (
            <div className="empty-list"><Sparkles size={34}/><b>ซับจะปรากฏตรงนี้</b><p>เลือกคลิปแล้วกด AI สร้างซับ</p></div>
          ) : (
            <div className="subtitle-list">
              {subtitles.map((subtitle) => (
                <div className="subtitle-row" key={subtitle.id}>
                  <button className="play-row" onClick={() => { if(videoRef.current){videoRef.current.currentTime=subtitle.start; void videoRef.current.play();}}}><Play size={15}/></button>
                  <div className="sub-fields">
                    <div className="times"><label>เริ่ม<input type="number" step="0.1" value={subtitle.start} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,start:Number(e.target.value)}:s))}/></label><label>จบ<input type="number" step="0.1" value={subtitle.end} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,end:Number(e.target.value)}:s))}/></label><span>{clock(subtitle.start)}</span></div>
                    <textarea value={subtitle.text} onChange={(e)=>setSubtitles((all)=>all.map((s)=>s.id===subtitle.id?{...s,text:e.target.value}:s))}/>
                  </div>
                  <button className="trash" onClick={()=>setSubtitles((all)=>all.filter((s)=>s.id!==subtitle.id))}><Trash2 size={17}/></button>
                </div>
              ))}
            </div>
          )}
          <div className="actions">
            <button className="secondary" disabled={!subtitles.length} onClick={downloadSrt}><Download size={18}/>ดาวน์โหลด SRT</button>
            <button className="primary" disabled={!subtitles.length || rendering} onClick={renderVideo}>{rendering ? <LoaderCircle className="spin"/> : <Film size={18}/>} {rendering ? `กำลังสร้าง ${renderProgress}%` : "สร้างวิดีโอพร้อมซับ"}</button>
          </div>
          <div className="notice">สร้างวิดีโอด้วย Chrome หรือ Edge บนคอม ไฟล์ผลลัพธ์เป็น WebM และไม่มีลายน้ำ</div>
        </div>
      </section>
    </main>
  );
}
