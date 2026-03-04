import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("calendar.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS spheres (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sphere TEXT NOT NULL,
    day_index INTEGER DEFAULT 0
  );
`);

// Seed initial spheres if empty
const existingSpheres = db.prepare("SELECT COUNT(*) as count FROM spheres").get() as { count: number };
if (existingSpheres.count === 0) {
  const insert = db.prepare("INSERT INTO spheres (id, label, color) VALUES (?, ?, ?)");
  insert.run('Professional', 'Professional', '#D4E1F5');
  insert.run('Personal', 'Personal', '#FDE2E4');
  insert.run('Health', 'Health', '#E2F0CB');
  insert.run('Leisure', 'Leisure', '#FFF1E6');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Spheres API
  app.get("/api/spheres", (req, res) => {
    const spheres = db.prepare("SELECT * FROM spheres").all();
    res.json(spheres);
  });

  app.post("/api/spheres", (req, res) => {
    const { id, label, color } = req.body;
    db.prepare("INSERT INTO spheres (id, label, color) VALUES (?, ?, ?)").run(id, label, color);
    res.json({ id, label, color });
  });

  app.put("/api/spheres/:id", (req, res) => {
    const { label, color } = req.body;
    db.prepare("UPDATE spheres SET label = ?, color = ? WHERE id = ?").run(label, color, req.params.id);
    res.json({ id: req.params.id, label, color });
  });

  app.delete("/api/spheres/:id", (req, res) => {
    db.prepare("DELETE FROM spheres WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events").all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { title, description, start_time, end_time, sphere, day_index } = req.body;
    const info = db.prepare(`
      INSERT INTO events (title, description, start_time, end_time, sphere, day_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, description, start_time, end_time, sphere, day_index);
    
    res.json({ id: info.lastInsertRowid, ...req.body });
  });

  app.delete("/api/events/:id", (req, res) => {
    db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/events/:id", (req, res) => {
    const { title, description, start_time, end_time, sphere, day_index } = req.body;
    db.prepare(`
      UPDATE events 
      SET title = ?, description = ?, start_time = ?, end_time = ?, sphere = ?, day_index = ?
      WHERE id = ?
    `).run(title, description, start_time, end_time, sphere, day_index, req.params.id);
    res.json({ id: req.params.id, ...req.body });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
