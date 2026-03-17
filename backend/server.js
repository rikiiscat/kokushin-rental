import express from "express";
import cors from "cors";
import multer from "multer";
import mysql from "mysql2";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import fs from "fs";

dotenv.config();
const app = express();

// 📁 当前目录定义
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ 中间件
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 会话（登录状态）
app.use(
  session({
    secret: "kokushin_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 2 * 60 * 60 * 1000,  // 2小时
      sameSite: "lax",             // 允许同域请求携带 cookie
      secure: false,               // Render 免费版禁用 strict HTTPS cookie
    },    
  })
);

// ✅ 连接数据库（Aiven + SSL）
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: {
    ca: `
-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUcEwDqDnr2pXUI2TULYiTXpVP5oYwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1YmM4Mzc5NzYtYzM3YS00YTI0LThkODktZGU1MjFjYTA0
M2I5IEdFTiAxIFByb2plY3QgQ0EwHhcNMjUxMTA2MDM0MjA4WhcNMzUxMTA0MDM0
MjA4WjBAMT4wPAYDVQQDDDViYzgzNzk3Ni1jMzdhLTRhMjQtOGQ4OS1kZTUyMWNh
MDQzYjkgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAKyDe6O70OZjlfO4/VFqTUQjltICaGWIgONJU3g9BWwc1qhPXdAnnfYn
Q1CRUC2Ilb9HixnfdY5h8eDfozjomsKKYJgXkT9t1Rn6yg1aoxXBxjWmRWo8BKNV
qn0Z1JcazUuLLMKvagzfRLNBjLKRer2hrm1YTkY8WpdGua+7bdJH1vU+3n2yvADw
126lL1lAFm6AY5R08rf4SBJ8AxN2Mm4pxdsx9NN+5qhS4f+eh3EUfgN1tYOvVKgS
KQR16SpViWbpiv0UUEmTg9bdqEA/pprHj72lIXrLcKHT4osnq4n0UhbhcdfF4rQn
dT05bCks3p6MhOF3j9bGF/ksDZvSxbUNK+mMpbeCnxQwIYHyn5Puo0CvD6BtnPxF
1NvqgFujCILK6/MiulMcDKpWAWKnqdJKmEzUClt4NbsLJjpN/OYs8utmFSebTY9e
MYI+2g0LOBsQ6HLbaS15u5Ca/ZCpwTSPR8m7CVa+6hSt6Nfc53OOZA5MZySSwV8y
2Cuuu8coDQIDAQABo0IwQDAdBgNVHQ4EFgQUvYirOiB9YGd9m3Tm/EAFwKFz6ZUw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAFhNVkW8qBevOUS+J7npKbm8U31DAXRxgEyV1hTISkb8i9T7r5tQZnv0yxAp
H1FLI3rg61YrXfq5e9lb+jxa1HbMNEAkrY7BlAo3inx7hpWywuWO47Wap4lTetuR
CNtXJMyvn1IeR/58EhaDYy+Ice5RxB5lufU094VOtYsUQT3IcyVF74jjpjNtvDRv
zpsd1fzVZLZvg9yDugTIZiOhf3Ff+MtsjIbZzqrr+OXcRVtOUP2FaeWmNmGL7or/
+CRkCUtpPujnJ4Y9j+qBH2FF82CCBwONiSvvoKQNVUzOUSmgkbZg+YddxnMYAAno
LR7WNyf+HUZymy6ZxpOSb3LaeRP9MMqQfD+pEmWIzJFD/TzCNOH32KSpdsN0ghm4
xb33vfSV8LPl6tfJCf+zh085hGsjdZoMWVTqFESNb4Akco/33CKCQKi6x4fNdPJN
QZQ1n/MiDvMXwVngdibpNgu9eoGBckvmlpO00+xIEq7Uns422/KXcLWBz2G5ijco
mHntfw==
-----END CERTIFICATE-----
    `,
    minVersion: "TLSv1.2"
  },
});

// ✅ 连接测试
db.query("SELECT 1 AS ok", (err) => {
  if (err) console.error("❌ 数据库连接失败:", err);
  else console.log("✅ MySQL 已连接");
});

// ✅ Cloudinary 配置
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

// ✅ multer 使用内存存储（与 Cloudinary 一起用）
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ===================== 🧩 健康检查接口 =====================
app.get(["/api/health", "/api/health/"], (req, res) => {
  try {
    db.query("SELECT 1 AS ok", (err) => {
      if (err) {
        res.json({ ok: true, db: false, error: err.code || err.message });
      } else {
        res.json({ ok: true, db: true });
      }
    });    
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===================== 🧩 登录相关接口 =====================

// 登录
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "123456") {
    req.session.user = username;
    return res.json({ success: true, message: "✅ 登录成功" });
  }
  res.status(401).json({ success: false, message: "❌ 用户名或密码错误" });
});

// 登出
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "✅ 已退出登录" });
});

// 登录验证中间件
const requireLogin = (req, res, next) => {
  if (req.session.user) return next();
  res.status(403).json({ error: "请先登录再操作" });
};

// ===================== 🧩 车辆管理接口 =====================

// 获取车辆列表
app.get("/api/cars", (req, res) => {
  db.query("SELECT * FROM cars ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// 获取单个车辆详情
app.get("/api/cars/:id", (req, res) => {
  const id = req.params.id;
  db.query("SELECT * FROM cars WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length === 0)
      return res.status(404).json({ error: "未找到车辆" });
    res.json(results[0]);
  });
});

// 添加车辆（上传到 Cloudinary）
app.post("/api/cars", requireLogin, upload.single("photo"), async (req, res) => {
  const { name, price, description } = req.body;
  if (!req.file) return res.status(400).json({ error: "未上传图片" });

  try {
    // 封装 Cloudinary 上传流为 Promise
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "kokushin_cars" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    const imageUrl = result.secure_url;

    // 数据库写入
    const sql = "INSERT INTO cars (name, price, description, image) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, price, description, imageUrl], (err, dbResult) => {
      if (err) {
        console.error("❌ 数据库写入错误:", err);
        return res.status(500).json(err);
      }
      console.log("✅ 新增车辆成功:", name);
      res.json({
        id: dbResult.insertId,
        name,
        price,
        description,
        image: imageUrl,
      });
    });
  } catch (error) {
    console.error("❌ 上传失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 修改车辆（可选更新图片）
app.put("/api/cars/:id", requireLogin, upload.single("photo"), (req, res) => {
  const id = req.params.id;
  const { name, price, description } = req.body;
  const updates = [];
  const values = [];

  if (name) {
    updates.push("name=?");
    values.push(name);
  }
  if (price) {
    updates.push("price=?");
    values.push(price);
  }
  if (description) {
    updates.push("description=?");
    values.push(description);
  }

  // 若上传了新图片则上传 Cloudinary
  if (req.file) {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "kokushin_cars" },
      (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        updates.push("image=?");
        values.push(result.secure_url);

        const sql = `UPDATE cars SET ${updates.join(", ")} WHERE id=?`;
        values.push(id);
        db.query(sql, values, (err) => {
          if (err) return res.status(500).json(err);
          res.json({ success: true });
        });
      }
    );
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } else {
    if (updates.length === 0)
      return res.status(400).json({ error: "未提供任何更新内容" });
    const sql = `UPDATE cars SET ${updates.join(", ")} WHERE id=?`;
    values.push(id);
    db.query(sql, values, (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    });
  }
});

// 删除车辆
app.delete("/api/cars/:id", requireLogin, (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM cars WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// ===================== 🧩 静态前端文件 =====================
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/photos", express.static(path.join(__dirname, "../frontend/photos")));

// sitemap
app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/sitemap.xml"));
});

// 兜底返回首页
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  }
});

// ===================== 🧩 启动服务器 =====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚗 Server running on http://localhost:${PORT}`)
);
