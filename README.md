# Cake Sub V3.2 Exact

หน้าตาโทนม่วงแบบเวอร์ชันแรก + Groq Whisper Large V3

## สิ่งที่ปรับ
- ไม่มี prompt ที่ชวนให้ AI ตีความ
- บังคับภาษาไทย + transcribe เท่านั้น
- temperature 0
- กรอง segment ที่ความมั่นใจต่ำ ช่วงเงียบ และข้อความซ้ำหลอน
- ไม่มี fallback ข้อความยาว ๆ ที่แต่งเอง
- แก้ซับและเวลาได้
- ดาวน์โหลด SRT
- สร้างวิดีโอ WebM พร้อมซับ ไม่มีลายน้ำ

## Deploy Vercel
1. อัปโหลดไฟล์ทั้งหมดขึ้น GitHub
2. Root Directory: `./`
3. Build Command: `npm run build`
4. Output Directory: ปล่อยว่าง
5. Environment Variable: `GROQ_API_KEY`
6. Redeploy

`next.config.ts` ต้องไม่มี `output: "export"`
