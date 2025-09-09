const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ytdlpCommand = process.platform === 'win32' ? 'C:\\Users\\dell\\Documents\\yt-dlp\\yt-dlp.exe' : 'yt-dlp';

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp_downloads');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/download-file/:filename", (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(tempDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error sending file:", err);
            }
            // Clean up the file after download attempt
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error("Error deleting temp file:", unlinkErr);
                }
            });
        });
    } else {
        res.status(404).send("File not found.");
    }
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("download-video", ({ videoUrl, quality }) => {
        console.log(`Received download request for ${videoUrl} at ${quality}p from ${socket.id}`);

        const qualityMap = {
            '1080': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '720': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
            '360': 'best[height<=360]'
        };
        const format = qualityMap[quality] || qualityMap['360'];

        const randomBytes = crypto.randomBytes(8).toString('hex');
        const tempFilename = `${randomBytes}.mp4`;
        const outputPath = path.join(tempDir, tempFilename);

        const ytdlpArgs = [
            videoUrl,
            '--progress',
            '--newline', // Makes progress parsing more reliable
            '--merge-output-format', 'mp4', // Ensures the final file is mp4
            '-f', format,
            '-o', outputPath,
        ];

        const ytdlp = spawn(ytdlpCommand, ytdlpArgs);

        const progressRegex = /\\\[download\\\\]\\s+(?<percent>\\d+\\.\\d)%/;

        ytdlp.stderr.on('data', (data) => {
            const text = data.toString();
            console.log("yt-dlp stderr:", text); // Added for debugging progress
            const match = text.match(progressRegex);
            if (match) {
                const percent = parseFloat(match.groups.percent);
                socket.emit('progress', { percent });
            }
        });

        ytdlp.on('error', (error) => {
            console.error(`yt-dlp spawn error: ${error.message}`);
            socket.emit('download-error', { message: 'Failed to start the download process.' });
        });

        ytdlp.on('close', (code) => {
            if (code === 0) {
                console.log("Download completed successfully.");
                socket.emit('complete', { filename: tempFilename });
            } else {
                console.error(`yt-dlp process exited with code ${code}`);
                socket.emit('download-error', { message: `Download failed. The video may not be available in ${quality}p or another error occurred.` });
                // Clean up failed download
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            }
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});