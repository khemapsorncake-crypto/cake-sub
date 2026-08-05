# Cake Sub V3.4 — Mobile + Long Thai Text Fix

แก้ไข:
- เปิดหน้าเว็บบนมือถือได้ดีขึ้น
- ซับภาษาไทยยาวตัดบรรทัดตามคำ ไม่ตัดข้อความทิ้ง
- ลดขนาดฟอนต์อัตโนมัติเมื่อข้อความยาว
- กันซับตกขอบบน/ล่างของวิดีโอ
- ดาวน์โหลดไฟล์แบบ MP4 เมื่อเบราว์เซอร์รองรับ
- fallback เป็น WebM ที่เป็นไฟล์วิดีโอจริง
- หน่วงการ revoke URL เพื่อแก้ปัญหามือถือดาวน์โหลดไฟล์ 0 KB
- เอา `output: export` และพารามิเตอร์ Groq `task` ออก

ตั้งค่า Vercel:
- Framework: Next.js
- Root Directory: ว่าง หรือ ./
- Output Directory: ว่าง
- Environment Variable: GROQ_API_KEY
