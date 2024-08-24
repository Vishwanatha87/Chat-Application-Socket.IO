import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: "chat.db",
  driver: sqlite3.Database,
});

await db.exec("DROP TABLE IF EXISTS messages;");
await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);


const rows = await db.all("PRAGMA table_info(messages);");
console.log(rows);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

const __dirname = dirname(fileURLToPath(import.meta.url));
console.log("__dirname", __dirname);

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

io.on("connection", async (socket) => {
  socket.on("chat message", async (msg) => {
    let result;
    try {
      // store the message in the db
      result = await db.run("INSERT INTO messages (content) VALUES (?)", msg);
    } catch (e) {
      // to handle the error
    //   console.log(e);
     console.log(e)
    }
    io.emit("chat message", msg);
  });

  if(!socket.recovered){
    // if the connection state recovery was not successfull
    try{
        await db.each('SELECT id, content FROM messages WHERE id> ?',[socket.handshake.auth.serverOffset || 0], (_err, row) => {
            socket.emit('chat message', row.content, row.id)
        })
    } catch(e){
        return;
    }
}
});

server.listen(3000, () => {
  console.log("server listening at localhost");
});
