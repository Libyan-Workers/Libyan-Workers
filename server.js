// server.js

// ➤ تحميل متغيرات البيئة
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const bodyParser  = require('body-parser');
const multer      = require('multer');
const streamifier = require('streamifier');
const cloudinary  = require('cloudinary').v2;
const admin       = require('firebase-admin');

const app  = express();
const port = process.env.PORT || 7000;

// ➤ إعداد Firebase Admin من متغيرات البيئة
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

// ➤ إعداد Cloudinary من متغيرات البيئة
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// إعداد multer لتخزين الملفات في الذاكرة
const upload = multer({ storage: multer.memoryStorage() });

// ✅ إعداد CORS
const corsOptions = {
  origin: [
    'http://localhost:7000',
    'http://example.com',
    'https://libyan-workers.github.io'
  ],
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ➤ 1) نقطة نهاية لتسليم المتغيرات للواجهة (يجب أن تكون قبل express.static)
app.get('/env.js', (req, res) => {
  const safeEnv = {
    NODE_ENV:                     process.env.NODE_ENV,
    PORT:                         process.env.PORT,
    FIREBASE_API_KEY:             process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN:         process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_DATABASE_URL:        process.env.FIREBASE_DATABASE_URL,
    FIREBASE_PROJECT_ID:          process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET:      process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID:              process.env.FIREBASE_APP_ID,
    FIREBASE_MEASUREMENT_ID:      process.env.FIREBASE_MEASUREMENT_ID,
    VAPID_KEY:                    process.env.VAPID_KEY,
    PUSHER_INSTANCE_ID:           process.env.PUSHER_INSTANCE_ID,
    OPENWEATHER_API_KEY:          process.env.OPENWEATHER_API_KEY,
    MAPBOX_ACCESS_TOKEN:          process.env.MAPBOX_API_KEY
  };
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window._env_ = ${JSON.stringify(safeEnv)};`);
});

// ➤ 2) تقديم المحتوى الثابت بعد نقطة env.js
app.use(express.static(path.join(__dirname, 'public')));
app.use('/server1', express.static(path.join(__dirname, 'public', 'server1')));

// ➤ 3) أي مسارات أخرى تحت الملفات الثابتة
app.get('/custom-firebase-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'custom-firebase-worker.js'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API تجريبية
app.get('/config', (req, res) => {
  res.json({ NODE_ENV: process.env.NODE_ENV || 'development' });
});

// ➤ 4) نقطة نهاية لإرسال الإشعار عبر Firebase Admin
// يتوقع body JSON به: { deviceToken: string, message: string }
app.post('/api/send-notification', async (req, res) => {
  const { deviceToken, message } = req.body;

  const payload = {
    notification: {
      title: 'طلب جديد!',
      body: message,
      icon: 'https://example.com/icon.png'
    }
  };

  try {
    const response = await admin.messaging().sendToDevice(deviceToken, payload);
    res.json({ success: true, response });
  } catch (err) {
    console.error('Firebase Admin Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ➤ 5) نقطة نهاية لإرسال الإشعار المخصصة للعميل عبر /send-notification
// يتوقع body JSON به: { workerId: string, message: string }
app.post('/send-notification', (req, res) => {
  const { workerId, message } = req.body;
  console.log('Custom notification request received:', workerId, message);

  // هنا يمكنك إضافة منطق الإرسال الفعلي عبر Pusher أو أي خدمة أخرى
  // مثال توضيحي:
  // pusher.trigger(`private-worker-${workerId}`, 'new-notification', { message });

  res.json({ success: true, workerId, message });
});

// رفع الصور إلى Cloudinary
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم اختيار أي صورة' });

  const streamUpload = () => new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'uploads' },
      (error, result) => error ? reject(error) : resolve(result)
    );
    streamifier.createReadStream(req.file.buffer).pipe(stream);
  });

  streamUpload()
    .then(result => res.json({ secure_url: result.secure_url }))
    .catch(err => {
      console.error('خطأ في رفع الصورة إلى Cloudinary:', err);
      res.status(500).json({ error: 'فشل رفع الصورة' });
    });
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).send(`Something broke! Error: ${err.message}`);
});

// تشغيل الخادم
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
