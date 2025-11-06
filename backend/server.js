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
      maxAge: 2 * 60 * 60 * 1000, // 2小时
      sameSite: "none",
      secure: true,
    },
  })
);

// ✅ 连接数据库（Aiven）
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true
  }
});

db.connect((err) => {
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
    if (db.state === "authenticated") {
      res.json({ ok: true, db: true });
    } else {
      res.json({ ok: true, db: false });
    }
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
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "kokushin_cars" },
      (error, result) => {
        if (error) return res.status(500).json({ error: error.message });

        const imageUrl = result.secure_url;
        const sql =
          "INSERT INTO cars (name, price, description, image) VALUES (?, ?, ?, ?)";
        db.query(sql, [name, price, description, imageUrl], (err, dbResult) => {
          if (err) return res.status(500).json(err);
          res.json({
            id: dbResult.insertId,
            name,
            price,
            description,
            image: imageUrl,
          });
        });
      }
    );
    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
