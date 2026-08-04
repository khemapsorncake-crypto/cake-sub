"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, FolderOpen, Plus, RotateCcw, Save, Sparkles, Trash2, Upload } from "lucide-react";

type Subtitle = { id: string; start: number; end: number; text: string };
type Style = { fontSize: number; textColor: string; highlightColor: string; strokeColor: string; position: "top" | "middle" | "bottom"; effect: "pop" | "fade" | "none" };

const defaultSubs: Subtitle[] = [
  { id: "1", start: 0, end: 2.8, text: "แตะข้อความตรงนี้เพื่อแก้ซับได้เลย" },
  { id: "2", start: 2.8, end: 5.8, text: "ปรับฟอนต์ สี และตำแหน่งด้านล่าง" },
];
const defaultStyle: Style = { fontSize: 34, textColor: "#ffffff", highlightColor: "#facc15", strokeColor: "#111827", position: "bottom", effect: "pop" };

function fmt(t: number) {
  const m = Math.floor(t / 60).toString().padStart(2, "0");
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  const ms = Math.round((t % 1) * 1000).toString().padStart(3, "0");
  return `${m}:${s}.${ms}`;
}
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
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [subs, setSubs] = useState<Subtitle[]>(defaultSubs);
  const [style, setStyle] = useState<Style>(defaultStyle);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("cake-sub-project");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.subs) setSubs(p.subs);
      if (p.style) setStyle(p.style);
      if (p.fileName) setFileName(p.fileName);
    } catch {}
  }, []);

  const active = useMemo(() => subs.find(s => current >= s.start && current < s.end) ?? subs[0], [current, subs]);
  const positionClass = style.position === "top" ? "sub-top" : style.position === "middle" ? "sub-middle" : "sub-bottom";

  const chooseVideo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setSaved(false);
  };

  const updateSub = (id: string, patch: Partial<Subtitle>) => setSubs(v => v.map(s => s.id === id ? { ...s, ...patch } : s));
  const addSub = () => {
    const last = subs[subs.length - 1];
    const start = last?.end ?? 0;
    setSubs(v => [...v, { id: crypto.randomUUID(), start, end: start + 2.5, text: "พิมพ์ข้อความซับใหม่" }]);
  };
  const save = () => {
    localStorage.setItem("cake-sub-project", JSON.stringify({ fileName, subs, style }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  const exportSrt = () => {
    const data = subs.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/plain;charset=utf-8" }));
    a.download = `${fileName.replace(/\.[^.]+$/, "") || "cake-sub"}.srt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const reset = () => { setSubs(defaultSubs); setStyle(defaultStyle); localStorage.removeItem("cake-sub-project"); };

  return (
    <main>
      <header>
        <div className="brand"><div className="logo">🍰</div><div><h1>Cake Sub</h1><p>ทำซับง่าย คลิปพร้อมลง</p></div></div>
        <button className="icon-btn" onClick={save}><Save size={19}/><span>{saved ? "บันทึกแล้ว" : "บันทึก"}</span></button>
      </header>

      <section className="hero">
        <span className="pill"><Sparkles size={15}/> สำหรับใช้งานบนมือถือ</span>
        <h2>อัปคลิป แล้วแต่งซับได้ทันที</h2>
        <p>ไม่ต้องลากไทม์ไลน์ให้ยุ่งยาก แตะข้อความเพื่อแก้ แล้วปรับสไตล์ด้านล่าง</p>
        <input ref={inputRef} hidden type="file" accept="video/mp4,video/quicktime,video/*" onChange={chooseVideo}/>
        <button className="primary" onClick={() => inputRef.current?.click()}><Upload size={20}/>{videoUrl ? "เปลี่ยนวิดีโอ" : "เลือกวิดีโอจากโทรศัพท์"}</button>
        {fileName && <div className="filename"><Film size={16}/>{fileName}</div>}
      </section>

      <section className="workspace">
        <div className="video-card">
          <div className="phone-frame">
            {videoUrl ? <video ref={videoRef} src={videoUrl} controls playsInline onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)} /> : <div className="empty-video"><FolderOpen size={45}/><b>ยังไม่ได้เลือกวิดีโอ</b><span>รองรับ MP4, MOV และวิดีโอจากมือถือ</span></div>}
            <div className={`subtitle-preview ${positionClass} effect-${style.effect}`} style={{ fontSize: style.fontSize, color: style.textColor, WebkitTextStroke: `2px ${style.strokeColor}` }}>
              {active?.text || "ตัวอย่างซับของคุณ"}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title"><div><h3>ข้อความซับ</h3><p>แตะเพื่อแก้ข้อความและเวลา</p></div><button className="small" onClick={addSub}><Plus size={17}/>เพิ่ม</button></div>
          <div className="subtitle-list">
            {subs.map((s, i) => <div className="subtitle-row" key={s.id} onClick={() => { if(videoRef.current){ videoRef.current.currentTime=s.start; videoRef.current.play(); }}}>
              <div className="num">{i + 1}</div>
              <div className="sub-fields">
                <div className="times"><label>เริ่ม<input type="number" step="0.1" value={s.start} onChange={e => updateSub(s.id,{start:Number(e.target.value)})}/></label><label>จบ<input type="number" step="0.1" value={s.end} onChange={e => updateSub(s.id,{end:Number(e.target.value)})}/></label></div>
                <textarea value={s.text} onChange={e => updateSub(s.id,{text:e.target.value})}/>
              </div>
              <button className="trash" onClick={e => {e.stopPropagation(); setSubs(v => v.filter(x => x.id !== s.id));}}><Trash2 size={17}/></button>
            </div>)}
          </div>

          <div className="style-box">
            <div className="section-title"><div><h3>สไตล์ซับ</h3><p>ปรับแล้วดูตัวอย่างบนวิดีโอได้ทันที</p></div></div>
            <label className="range-label">ขนาดตัวอักษร <b>{style.fontSize}px</b><input type="range" min="22" max="58" value={style.fontSize} onChange={e => setStyle({...style,fontSize:Number(e.target.value)})}/></label>
            <div className="grid2">
              <label>สีตัวอักษร<input type="color" value={style.textColor} onChange={e => setStyle({...style,textColor:e.target.value})}/></label>
              <label>สีไฮไลต์<input type="color" value={style.highlightColor} onChange={e => setStyle({...style,highlightColor:e.target.value})}/></label>
              <label>สีขอบ<input type="color" value={style.strokeColor} onChange={e => setStyle({...style,strokeColor:e.target.value})}/></label>
              <label>ตำแหน่ง<select value={style.position} onChange={e => setStyle({...style,position:e.target.value as Style["position"]})}><option value="top">ด้านบน</option><option value="middle">ตรงกลาง</option><option value="bottom">ด้านล่าง</option></select></label>
              <label>เอฟเฟกต์<select value={style.effect} onChange={e => setStyle({...style,effect:e.target.value as Style["effect"]})}><option value="pop">เด้ง</option><option value="fade">เฟด</option><option value="none">ไม่มี</option></select></label>
            </div>
          </div>

          <div className="actions">
            <button className="secondary" onClick={reset}><RotateCcw size={18}/>เริ่มใหม่</button>
            <button className="primary" onClick={exportSrt}><Download size={18}/>ดาวน์โหลดไฟล์ SRT</button>
          </div>
          <div className="notice">เวอร์ชันนี้แก้ซับ ปรับสไตล์ บันทึกโปรเจกต์ในเครื่อง และส่งออก SRT ได้ โดยยังไม่เผาซับลงวิดีโออัตโนมัติ</div>
        </div>
      </section>
    </main>
  );
}
