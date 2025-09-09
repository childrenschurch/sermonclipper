const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const ytdlpCommand = process.platform === 'win32' ? 'C:\\Users\\dell\\Documents\\yt-dlp\\yt-dlp.exe' : 'yt-dlp';

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index", { error: null, success: null });
});

app.post("/download", (req, res) => {
  const { url: videoUrl, quality } = req.body;

  // Validate quality and set format string
  const qualityMap = {
    '1080': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '720': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '360': 'best[height<=360]' // 360p often has audio included
  };
  const format = qualityMap[quality] || qualityMap['360']; // Default to 360p

  if (!videoUrl || !isValidUrl(videoUrl)) {
    return res.render("index", { error: "Please enter a valid URL.", success: null });
  }

  const titleProcess = spawn(ytdlpCommand, ["--get-title", videoUrl]);
  let videoTitle = "video";
  let titleError = "";

  titleProcess.stderr.on('data', (data) => {
    titleError += data.toString();
  });

  titleProcess.stdout.on("data", (data) => {
    videoTitle = data.toString().trim().replace(/[\\/:*?"<>|]/g, "-");
  });

  titleProcess.on("error", (error) => {
    console.error(`Failed to start title process: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).render("index", { error: `Failed to start the download process. Check if the path to yt-dlp.exe is correct.`, success: null });
    }
  });

  titleProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`yt-dlp (title) exited with code ${code}: ${titleError}`);
      if (!res.headersSent) {
        res.status(500).render("index", { error: "Failed to get video information. The URL might be invalid or unsupported.", success: null });
      }
      return;
    }

    const safeVideoTitle = `${videoTitle} [${quality}p]`;
    res.header("Content-Disposition", `attachment; filename="${safeVideoTitle}.mp4"`);

    const ytdlp = spawn(ytdlpCommand, [
      "-f", format,
      "--output", "-",
      videoUrl
    ]);

    ytdlp.stdout.pipe(res);

    ytdlp.on("error", (error) => {
      console.error(`Failed to start download process: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).send("Error starting download.");
      }
    });

    ytdlp.stderr.on('data', (data) => {
      console.error(`yt-dlp stderr: ${data}`);
    });

    ytdlp.on("close", (code) => {
      if (code !== 0) {
        console.error(`yt-dlp (download) process exited with code ${code}`);
      }
      res.end();
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
