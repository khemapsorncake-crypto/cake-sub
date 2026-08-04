# Cake Sub V2.1

เวอร์ชันนี้เพิ่ม AI ถอดเสียงภาษาไทยอัตโนมัติ พร้อมสร้างซับตามช่วงเวลา แก้ข้อความ ดูตัวอย่าง และดาวน์โหลด SRT

## ติดตั้ง

```bash
npm install
npm run dev
```

## ตั้งค่า OpenAI API Key

สร้างไฟล์ `.env.local`

```env
OPENAI_API_KEY=ใส่คีย์ของคุณ
```

บน Vercel ไปที่ **Project Settings → Environment Variables** แล้วเพิ่มชื่อ `OPENAI_API_KEY` จากนั้น Redeploy

## ข้อจำกัดของชุดนี้

- รองรับคลิปไม่เกิน 4 MB เพื่อให้ผ่านการอัปโหลดบน Vercel แบบเริ่มต้น
- ยังไม่ฝังซับกลับลง MP4 โดยตรง
- ขั้นถัดไปควรเพิ่ม object storage และ worker สำหรับคลิปขนาดใหญ่/การ render
