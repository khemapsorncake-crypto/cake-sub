"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  CheckCircle2,
  Download,
  Film,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

type Subtitle = {
  id: string;
  start: number;
  end: number;
  text: string;
};

type ProgressState = {
  label: string;
  percent: number;
};

type WhisperChunk = {
  text?: string;
  timestamp?: [number | null, number | null];
};

const MODEL_ID = "onnx-community/whisper-tiny";

function srtTime(time: number) {
  const safe = Math.max(0, Number.isFinite(time) ? time : 0);
  const hours = Math.floor(safe / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  const milliseconds = Math.round((safe % 1) * 1000)
    .toString()
    .padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

function clockTime(time: number) {
  const safe = Math.max(0, Number.isFinite(time) ? time : 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function decodeAndResample(file: File): Promise<Float32Array> {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับการอ่านเสียงจากวิดีโอ");
  }

  const audioContext = new AudioContextClass();
  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    const targetRate = 16_000;
    const targetLength = Math.ceil(decoded.duration * targetRate);
    const offline = new OfflineAudioContext(1, targetLength, targetRate);
    const source = offline.createBufferSource();
    const monoBuffer = offline.createBuffer(
      1,
      decoded.length,
      decoded.sampleRate,
    );
    const mono = monoBuffer.getChannelData(0);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        mono[index] += data[index] / decoded.numberOfChannels;
      }
    }

    source.buffer = monoBuffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `อ่านเสียงไม่สำเร็จ: ${error.message}`
        : "อ่านเสียงจากคลิปไม่สำเร็จ",
    );
  } finally {
    await audioContext.close();
  }
}

function normalizeChunks(chunks: WhisperChunk[], fullText: string): Subtitle[] {
  const cleaned = chunks
    .map((chunk, index) => {
      const start = Number(chunk.timestamp?.[0] ?? 0);
      const endValue = chunk.timestamp?.[1];
      const end = Number(endValue ?? start + 3);
      const text = (chunk.text ?? "").trim();
      if (!text) return null;
      return {
        id: `${Date.now()}-${index}`,
        start,
        end: Math.max(end, start + 0.35),
        text,
      } satisfies Subtitle;
    })
    .filter((item): item is Subtitle => item !== null);

  if (cleaned.length > 0) return cleaned;
  const text = fullText.trim();
  return text
    ? [{ id: `${Date.now()}-0`, start: 0, end: 5, text }]
    : [];
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrlRef = useRef<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  const activeSubtitle = useMemo(
    () =>
      subtitles.find(
        (subtitle) =>
          currentTime >= subtitle.start && currentTime < subtitle.end,
      ),
    [currentTime, subtitles],
  );

  function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("กรุณาเลือกไฟล์วิดีโอ MP4 หรือ MOV");
      return;
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    videoUrlRef.current = nextUrl;
    setVideoFile(file);
    setVideoUrl(nextUrl);
    setSubtitles([]);
    setError("");
    setReady(false);
    setProgress(null);
  }

  async function generateSubtitles() {
    if (!videoFile || progress) return;
    setError("");
    setReady(false);
    try {
      setProgress({ label: "กำลังอ่านเสียงจากคลิป", percent: 5 });
      const audio = await decodeAndResample(videoFile);

      setProgress({ label: "กำลังโหลดโมเดล AI ครั้งแรก", percent: 15 });
      const transformersUrl =
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm";
      const { env, pipeline } = await import(
        /* webpackIgnore: true */ transformersUrl
      );
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const transcriber = await pipeline(
        "automatic-speech-recognition",
        MODEL_ID,
        {
          dtype: "q8",
          device: "wasm",
          progress_callback: (item: unknown) => {
            const info = item as {
              status?: string;
              progress?: number;
              file?: string;
            };
            if (typeof info.progress === "number") {
              const modelProgress = Math.max(
                15,
                Math.min(65, 15 + info.progress * 0.5),
              );
              setProgress({
                label:
                  info.status === "ready"
                    ? "โหลด AI สำเร็จ"
                    : `กำลังโหลด AI${info.file ? `: ${info.file}` : ""}`,
                percent: Math.round(modelProgress),
              });
            }
          },
        },
      );

      setProgress({ label: "AI กำลังฟังและสร้างซับ", percent: 70 });
      const rawResult = await transcriber(audio, {
        language: "thai",
        task: "transcribe",
        return_timestamps: true,
        chunk_length_s: 20,
        stride_length_s: 4,
      });
      const result = rawResult as unknown as {
        text?: string;
        chunks?: WhisperChunk[];
      };

      const nextSubtitles = normalizeChunks(
        Array.isArray(result.chunks) ? result.chunks : [],
        result.text ?? "",
      );
      if (nextSubtitles.length === 0) {
        throw new Error("AI ไม่พบเสียงพูดในคลิปนี้");
      }
      setProgress({ label: "จัดช่วงเวลาให้ซับ", percent: 95 });
      setSubtitles(nextSubtitles);
      setReady(true);
      setProgress(null);
    } catch (caught) {
      console.error(caught);
      setProgress(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "สร้างซับไม่สำเร็จ กรุณาลองคลิปที่สั้นลง",
      );
    }
  }

  function updateSubtitle(id: string, patch: Partial<Subtitle>) {
    setSubtitles((current) =>
      current.map((subtitle) =>
        subtitle.id === id ? { ...subtitle, ...patch } : subtitle,
      ),
    );
  }

  function deleteSubtitle(id: string) {
    setSubtitles((current) =>
      current.filter((subtitle) => subtitle.id !== id),
    );
  }

  function seekTo(subtitle: Subtitle) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = subtitle.start;
    void videoRef.current.play();
  }

  function downloadSrt() {
    if (!subtitles.length) return;
    const body = subtitles
      .map(
        (subtitle, index) =>
          `${index + 1}\n${srtTime(subtitle.start)} --> ${srtTime(subtitle.end)}\n${subtitle.text}\n`,
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${videoFile?.name.replace(/\.[^.]+$/, "") || "cake-sub"}.srt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current = "";
    setVideoFile(null);
    setVideoUrl("");
    setCurrentTime(0);
    setSubtitles([]);
    setProgress(null);
    setError("");
    setReady(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main>
      <header>
        <div className="brand">
          <div className="logo">🍰</div>
          <div>
            <h1>Cake Sub</h1>
            <p>AI สร้างซับฟรีในเบราว์เซอร์</p>
          </div>
        </div>
        <span className="free-badge">ไม่ใช้ API Key</span>
      </header>

      <section className="hero">
        <span className="pill">
          <Sparkles size={15} /> ประมวลผลบนโทรศัพท์หรือคอมของคุณ
        </span>
        <h2>เลือกคลิป แล้วให้ AI สร้างซับให้เลย</h2>
        <p>
          ถอดเสียงภาษาไทยพร้อมช่วงเวลา แก้ข้อความได้ และดาวน์โหลดเป็น SRT
          โดยไม่ส่งคลิปไปยังเซิร์ฟเวอร์ของ Cake Sub
        </p>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          onChange={selectVideo}
        />
        <button className="primary" onClick={() => inputRef.current?.click()}>
          <Upload size={20} />
          {videoFile ? "เปลี่ยนวิดีโอ" : "เลือกวิดีโอจากโทรศัพท์"}
        </button>
        {videoFile && (
          <div className="filename">
            <Film size={16} />
            <span>{videoFile.name}</span>
            <small>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</small>
          </div>
        )}
      </section>

      <section className="workspace">
        <div className="video-column">
          <div className="phone-frame">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                onTimeUpdate={(event) =>
                  setCurrentTime(event.currentTarget.currentTime)
                }
              />
            ) : (
              <div className="empty-video">
                <Film size={48} />
                <b>ยังไม่ได้เลือกวิดีโอ</b>
                <span>แนะนำให้ทดลองด้วยคลิปสั้น 15–60 วินาทีก่อน</span>
              </div>
            )}
            {activeSubtitle && (
              <div className="subtitle-preview">{activeSubtitle.text}</div>
            )}
          </div>

          {videoFile && (
            <button
              className="ai-button"
              onClick={generateSubtitles}
              disabled={Boolean(progress)}
            >
              {progress ? (
                <LoaderCircle className="spin" size={21} />
              ) : (
                <Bot size={21} />
              )}
              {progress ? progress.label : "AI สร้างซับอัตโนมัติ"}
            </button>
          )}

          {progress && (
            <div className="progress-card">
              <div className="progress-head">
                <span>{progress.label}</span>
                <b>{progress.percent}%</b>
              </div>
              <div className="progress-track">
                <div style={{ width: `${progress.percent}%` }} />
              </div>
              <p>
                ครั้งแรกต้องดาวน์โหลดโมเดล AI และอาจใช้เวลานานกว่าครั้งต่อไป
              </p>
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
          {ready && (
            <div className="success-box">
              <CheckCircle2 size={18} /> สร้างซับสำเร็จ {subtitles.length} ช่วง
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-title">
            <div>
              <h3>ข้อความซับ</h3>
              <p>แตะแถวเพื่อเล่นวิดีโอตรงช่วงนั้น</p>
            </div>
            <span>{subtitles.length} ช่วง</span>
          </div>

          {subtitles.length === 0 ? (
            <div className="empty-list">
              <Bot size={38} />
              <b>ซับจะปรากฏตรงนี้</b>
              <p>เลือกคลิปแล้วกด “AI สร้างซับอัตโนมัติ”</p>
            </div>
          ) : (
            <div className="subtitle-list">
              {subtitles.map((subtitle, index) => (
                <div className="subtitle-row" key={subtitle.id}>
                  <button
                    className="play-row"
                    onClick={() => seekTo(subtitle)}
                    aria-label={`เล่นซับช่วงที่ ${index + 1}`}
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                  <div className="sub-fields">
                    <div className="times">
                      <label>
                        เริ่ม
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={subtitle.start}
                          onChange={(event) =>
                            updateSubtitle(subtitle.id, {
                              start: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        จบ
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={subtitle.end}
                          onChange={(event) =>
                            updateSubtitle(subtitle.id, {
                              end: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <span>
                        {clockTime(subtitle.start)}–{clockTime(subtitle.end)}
                      </span>
                    </div>
                    <textarea
                      value={subtitle.text}
                      onChange={(event) =>
                        updateSubtitle(subtitle.id, {
                          text: event.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    className="trash"
                    onClick={() => deleteSubtitle(subtitle.id)}
                    aria-label="ลบซับ"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="actions">
            <button className="secondary" onClick={resetAll}>
              <RotateCcw size={18} /> เริ่มใหม่
            </button>
            <button
              className="primary"
              onClick={downloadSrt}
              disabled={!subtitles.length}
            >
              <Download size={18} /> ดาวน์โหลด SRT
            </button>
          </div>

          <div className="notice">
            <b>หมายเหตุ:</b> รุ่นนี้สร้างซับและดาวน์โหลด SRT ได้ก่อน
            ยังไม่ได้เผาซับลงไฟล์ MP4 โดยตรง
            การถอดเสียงบนมือถือขึ้นอยู่กับ RAM และความเร็วของเครื่อง
          </div>
        </div>
      </section>
    </main>
  );
}
