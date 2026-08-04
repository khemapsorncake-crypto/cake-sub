"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Film,
  FolderOpen,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";

type Subtitle = { id: string; start: number; end: number; text: string };
type Style = {
  fontSize: number;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  position: "top" | "middle" | "bottom";
  effect: "pop" | "fade" | "none";
};

const defaultSubs: Subtitle[] = [
  { id: "1", start: 0, end: 3, text: "เลือกคลิป แล้วกด AI สร้างซับ" },
];
const defaultStyle: Style = {
  fontSize: 34,
  textColor: "#ffffff",
  highlightColor: "#facc15",
  strokeColor: "#111827",
  position: "bottom",
  effect: "pop",
};

function srtTime(t: number) {
  const h = Math.floor(t / 3600).toString().padStart(2, "0");
  const m = Math.floor((t % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  const ms = Math.round((t % 1) * 1000).toString().padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [subs, setSubs] = useState<Subtitle[]>(defaultSubs);
  const [style, setStyle] = useState<Style>(defaultStyle);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("cake-sub-project");
    if (!raw) return;
    try {
      const project = JSON.parse(raw);
      if (project.subs) setSubs(project.subs);
      if (project.style) setStyle(project.style);
      if (project.fileName) setFileName(project.fileName);
    } catch {
      localStorage.removeItem("cake-sub-project");
    }
  }, []);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const active = useMemo(
    () => subs.find((subtitle) => current >= subtitle.start && current < subtitle.end),
    [current, subs],
  );
  const positionClass =
    style.position === "top" ? "sub-top" : style.position === "middle" ? "sub-middle" : "sub-bottom";

  const chooseVideo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setError("");
    setSaved(false);
  };

  const transcribe = async () => {
    if (!videoFile) {
      setError("กรุณาเลือกวิดีโอก่อน");
      return;
    }
    setTranscribing(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", videoFile);
      form.append("language", "th");
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI ถอดเสียงไม่สำเร็จ");
      if (!Array.isArray(data.segments) || data.segments.length === 0) {
        throw new Error("ไม่พบเสียงพูดในคลิป");
      }
      setSubs(data.segments);
      setCurrent(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด");
    } finally {
      setTranscribing(false);
    }
  };

  const updateSub = (id: string, patch: Partial<Subtitle>) =>
    setSubs((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const addSub = () => {
    const last = subs[subs.length - 1];
    const start = last?.end ?? 0;
    setSubs((items) => [
      ...items,
      { id: crypto.randomUUID(), start, end: start + 2.5, text: "พิมพ์ข้อความซับใหม่" },
    ]);
  };

  const save = () => {
    localStorage.setItem("cake-sub-project", JSON.stringify({ fileName, subs, style }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const exportSrt = () => {
    const data = subs
      .map((subtitle, index) =>
        `${index + 1}\n${srtTime(subtitle.start)} --> ${srtTime(subtitle.end)}\n${subtitle.text}\n`,
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([data], { type: "text/plain;charset=utf-8" }));
    link.download = `${fileName.replace(/\.[^.]+$/, "") || "cake-sub"}.srt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const reset = () => {
    setSubs(defaultSubs);
    setStyle(defaultStyle);
    setError("");
    localStorage.removeItem("cake-sub-project");
  };

  return (
    <main>
      <header>
        <div className="brand">
          <div className="logo">🍰</div>
          <div><h1>Cake Sub</h1><p>AI ทำซับให้ คลิปพร้อมลง</p></div>
        </div>
        <button className="icon-btn" onClick={save}><Save size={19}/><span>{saved ? "บันทึกแล้ว" : "บันทึก"}</span></button>
      </header>

      <section className="hero">
        <span className="pill"><Sparkles size={15}/> AI ถอดเสียงภาษาไทย</span>
        <h2>อัปคลิป แล้วให้ AI สร้างซับ</h2>
        <p>ระบบจับเสียง แบ่งช่วงเวลา และนำข้อความมาแสดงบนคลิปให้โดยอัตโนมัติ</p>
        <input ref={inputRef} hidden type="file" accept="video/mp4,video/quicktime,video/*" onChange={chooseVideo}/>
        <div className="hero-actions">
          <button className="secondary hero-button" onClick={() => inputRef.current?.click()}><Upload size={20}/>{videoUrl ? "เปลี่ยนวิดีโอ" : "เลือกวิดีโอ"}</button>
          <button className="primary hero-button" disabled={!videoFile || transcribing} onClick={transcribe}>
            {transcribing ? <LoaderCircle className="spin" size={20}/> : <WandSparkles size={20}/>} 
            {transcribing ? "กำลังถอดเสียง..." : "AI สร้างซับ"}
          </button>
        </div>
        {fileName && <div className="filename"><Film size={16}/>{fileName}</div>}
        {error && <div className="error-box">{error}</div>}
        <div className="limit-note">เวอร์ชันแรกใช้กับคลิปสั้น ขนาดไฟล์ไม่เกิน 4 MB</div>
      </section>

      <section className="workspace">
        <div className="video-card">
          <div className="phone-frame">
            {videoUrl ? (
              <video ref={videoRef} src={videoUrl} controls playsInline onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} />
            ) : (
              <div className="empty-video"><FolderOpen size={45}/><b>ยังไม่ได้เลือกวิดีโอ</b><span>รองรับ MP4, MOV และวิดีโอจากมือถือ</span></div>
            )}
            <div className={`subtitle-preview ${positionClass} effect-${style.effect}`} style={{ fontSize: style.fontSize, color: style.textColor, WebkitTextStroke: `2px ${style.strokeColor}` }}>
              {active?.text || "ตัวอย่างซับของคุณ"}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title"><div><h3>ข้อความซับ</h3><p>AI จัดเวลาให้แล้ว แตะเพื่อแก้ไขได้</p></div><button className="small" onClick={addSub}><Plus size={17}/>เพิ่ม</button></div>
          <div className="subtitle-list">
            {subs.map((subtitle, index) => (
              <div className="subtitle-row" key={subtitle.id} onClick={() => {
                if (videoRef.current) { videoRef.current.currentTime = subtitle.start; void videoRef.current.play(); }
              }}>
                <div className="num">{index + 1}</div>
                <div className="sub-fields">
                  <div className="times">
                    <label>เริ่ม<input type="number" step="0.1" value={subtitle.start} onChange={(event) => updateSub(subtitle.id, { start: Number(event.target.value) })}/></label>
                    <label>จบ<input type="number" step="0.1" value={subtitle.end} onChange={(event) => updateSub(subtitle.id, { end: Number(event.target.value) })}/></label>
                  </div>
                  <textarea value={subtitle.text} onChange={(event) => updateSub(subtitle.id, { text: event.target.value })}/>
                </div>
                <button className="trash" onClick={(event) => { event.stopPropagation(); setSubs((items) => items.filter((item) => item.id !== subtitle.id)); }}><Trash2 size={17}/></button>
              </div>
            ))}
          </div>

          <div className="style-box">
            <div className="section-title"><div><h3>สไตล์ซับ</h3><p>ปรับแล้วดูตัวอย่างบนวิดีโอได้ทันที</p></div></div>
            <label className="range-label">ขนาดตัวอักษร <b>{style.fontSize}px</b><input type="range" min="22" max="58" value={style.fontSize} onChange={(event) => setStyle({ ...style, fontSize: Number(event.target.value) })}/></label>
            <div className="grid2">
              <label>สีตัวอักษร<input type="color" value={style.textColor} onChange={(event) => setStyle({ ...style, textColor: event.target.value })}/></label>
              <label>สีไฮไลต์<input type="color" value={style.highlightColor} onChange={(event) => setStyle({ ...style, highlightColor: event.target.value })}/></label>
              <label>สีขอบ<input type="color" value={style.strokeColor} onChange={(event) => setStyle({ ...style, strokeColor: event.target.value })}/></label>
              <label>ตำแหน่ง<select value={style.position} onChange={(event) => setStyle({ ...style, position: event.target.value as Style["position"] })}><option value="top">ด้านบน</option><option value="middle">ตรงกลาง</option><option value="bottom">ด้านล่าง</option></select></label>
              <label>เอฟเฟกต์<select value={style.effect} onChange={(event) => setStyle({ ...style, effect: event.target.value as Style["effect"] })}><option value="pop">เด้ง</option><option value="fade">เฟด</option><option value="none">ไม่มี</option></select></label>
            </div>
          </div>

          <div className="actions">
            <button className="secondary" onClick={reset}><RotateCcw size={18}/>เริ่มใหม่</button>
            <button className="primary" onClick={exportSrt}><Download size={18}/>ดาวน์โหลด SRT</button>
          </div>
          <div className="notice">ชุดนี้ทำ AI ถอดเสียงและสร้างซับพร้อมเวลาได้แล้ว ขั้นต่อไปจะเพิ่มการสร้าง MP4 ที่ฝังซับลงในคลิป</div>
        </div>
      </section>
    </main>
  );
}
