# Cake Sub Desktop Accurate V2.5

- Whisper Small เป็นค่าเริ่มต้น
- Whisper Medium เป็นโหมดทดลองสำหรับคอม RAM 16 GB ขึ้นไป
- ใช้ WebGPU อัตโนมัติเมื่อรองรับ และ fallback เป็น WASM/CPU
- แบ่งเสียงเป็นช่วง 28 วินาที ซ้อนกัน 3 วินาที เพื่อลดคำตกหล่น
- ไม่ใช้ API Key และ Deploy บน Vercel ได้

## Vercel
- Root Directory: ./
- Build Command: npm run build
- Output Directory: เว้นว่าง
- Environment Variables: ไม่ต้องใส่
