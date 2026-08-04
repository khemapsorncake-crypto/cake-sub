# Cake Sub Server AI V3

หน้าเดียว ไม่มี Login ไม่มี Dashboard และไม่มีลายน้ำ

## ตั้งค่า Vercel
1. อัปไฟล์ทั้งหมดขึ้น GitHub
2. Vercel > Project > Settings > Environment Variables
3. เพิ่ม `GROQ_API_KEY`
4. สร้างคีย์ฟรีจาก Groq Console แล้ววางเป็นค่า
5. Redeploy

## การใช้งาน
เลือกคลิป > AI สร้างซับ > แก้ข้อความ > ดาวน์โหลด SRT

หมายเหตุ: เพราะ Vercel จำกัด request 4.5 MB เวอร์ชันนี้แปลงวิดีโอเป็น WAV 16 kHz mono ก่อนส่ง และรองรับคลิปประมาณไม่เกิน 2 นาที 10 วินาทีต่อครั้ง
