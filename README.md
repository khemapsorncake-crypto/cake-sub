# Cake Sub Browser AI V2.2

เว็บสร้างซับภาษาไทยอัตโนมัติในเบราว์เซอร์ โดยใช้ Transformers.js + Whisper ไม่ต้องใช้ API Key

## วิธีติดตั้ง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

## Deploy บน Vercel

- Framework Preset: Next.js
- Root Directory: ปล่อยว่าง หรือ `./`
- Build Command: `npm run build`
- Output Directory: ปล่อยว่าง (Vercel ตรวจจับเอง)
- ไม่ต้องเพิ่ม Environment Variables

## วิธีใช้งาน

1. เลือกวิดีโอ MP4/MOV
2. กด AI สร้างซับอัตโนมัติ
3. ครั้งแรกเบราว์เซอร์จะดาวน์โหลดโมเดล Whisper
4. ตรวจและแก้ข้อความ/เวลา
5. ดาวน์โหลด SRT

## ข้อจำกัดของรุ่นนี้

- แนะนำให้เริ่มจากคลิป 15–60 วินาที
- มือถือ RAM น้อยอาจประมวลผลช้า หรือหน้าเว็บอาจรีโหลด
- ความสามารถถอดเสียงจากไฟล์ MP4/MOV ขึ้นกับ codec ที่เบราว์เซอร์รองรับ
- ยังไม่ได้ฝังซับลง MP4 โดยตรง
