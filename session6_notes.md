# ملاحظات الفحص البصري — Canvas Podium

- Canvas podium: 1200x760، يُرسَم عند فتح modal (display:flex)، الصورة PNG صالحة (dataURL يعمل)
- زر Download موجود في modal (canvas.toBlob + a.download)
- اللقطات screenshot للصفحة لا تظهر modal لأنها فوق viewport وقد تكون خلف overlay — لا مشكلة حقيقية
- تبقى: حذف عناصر الفحص (__ev_check)، حذف بيانات dev events (اختياري local)، commit+push، انتظار Railway، تحقق حي
