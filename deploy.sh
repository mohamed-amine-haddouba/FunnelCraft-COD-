#!/bin/bash

# إيقاف السكربت فوراً إذا حدث أي خطأ
set -e

cd /var/www/funnelcraft || exit

echo "--- بدء التحديث التلقائي: $(date) ---"

# حفظ رقم الـ commit الحالي
OLD_COMMIT=$(git rev-parse HEAD)

# جلب أحدث التغييرات من GitHub
git fetch origin main

# إجبار الخادم على التطابق التام مع GitHub (يتجاهل أي تعارضات محلية)
git reset --hard origin/main

# التحقق مما إذا كان هناك تحديث جديد
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" == "$NEW_COMMIT" ]; then
    echo "✅ لا توجد تحديثات جديدة."
    exit 0
fi

echo "🚀 تم العثور على تحديثات جديدة. جاري التثبيت والبناء..."

npm install --legacy-peer-deps
npm run build
pm2 restart funnelcraft-api --update-env

echo "--- ✅ تم التحديث بنجاح: $(date) ---"
