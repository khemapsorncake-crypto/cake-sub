# Cake Sub

เว็บทำซับสำหรับใช้งานบนโทรศัพท์

## วิธี Deploy บน Vercel

### วิธีที่แนะนำ: อัปขึ้น GitHub
1. แตกไฟล์ ZIP นี้ก่อน
2. สร้าง Repository ใหม่ใน GitHub
3. อัปโหลดไฟล์ทั้งหมดที่อยู่ภายในโฟลเดอร์ โดย `package.json` ต้องอยู่หน้าแรกของ Repository
4. เข้า Vercel > Add New > Project
5. เลือก Repository ของ Cake Sub
6. Framework Preset เลือก Next.js
7. Root Directory ปล่อยเป็น `./`
8. Build Command ใช้ `npm run build`
9. Output Directory เว้นว่าง ห้ามใส่ `public`
10. กด Deploy

## ตรวจตำแหน่งไฟล์
โครงสร้างที่ถูกต้องต้องเป็นแบบนี้

```
package.json
vercel.json
next.config.ts
app/
public/
```

ห้ามเป็นแบบนี้

```
cake-sub/
  package.json
  app/
```

ถ้า Repository เดิมมีโฟลเดอร์ `cake-sub` ซ้อน ให้ตั้ง Vercel > Project Settings > Build and Deployment > Root Directory เป็น `cake-sub`

## เปิดบนเครื่อง

```bash
npm install
npm run dev
```
