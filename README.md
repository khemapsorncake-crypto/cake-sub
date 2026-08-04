# Cake Sub Server AI V3.1

หน้าเดียวสำหรับเลือกวิดีโอ ถอดเสียง แก้ซับ และสร้างวิดีโอพร้อมซับโดยไม่มีลายน้ำ

## Vercel

1. อัปโหลดไฟล์ทั้งหมดขึ้น GitHub
2. Root Directory: `./`
3. Build Command: `npm run build`
4. Output Directory: ปล่อยว่าง
5. เพิ่ม Environment Variable ชื่อ `GROQ_API_KEY`
6. Redeploy

## หมายเหตุ

- รองรับคลิปไม่เกินประมาณ 2 นาที 10 วินาที
- ปุ่มสร้างวิดีโอพร้อมซับรองรับ Chrome/Edge บนคอม
- ไฟล์ผลลัพธ์เป็น WebM ไม่มีลายน้ำ
