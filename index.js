const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");

const dir = "../videos/";
const dir_removed = "../videos_removed/"

const { readdir } = require('node:fs/promises');
const { join } = require('node:path');

const getAllFiles = async (dirPath) => Promise.all(
    await readdir(dirPath, { withFileTypes: true }).then((entries) => entries.map((entry) => {
        const childPath = join(dirPath, entry.name)
        return entry.isDirectory() ? getAllFiles(childPath) : childPath;
    })),
)

const getAllFilesCB = async (dir, cb) => {
    cb(await getAllFiles(dir));
}

app.get("/player", function (req, res) {
    // get video from argument
    const path = req.query.video;
    const file = fs.readFileSync(__dirname + "/index.html", { encoding: "utf8", flag: "r"});
    
    res.send(file.replace("%VIDEO_PATH%", path));
});

const asyncGetAllFiles = (res) => {
    getAllFilesCB(dir, (allFiles) => {
        const allFilesList = allFiles.flat(Number.POSITIVE_INFINITY);
        let fileHtml = "";
        allFilesList.forEach(file => {
            fileHtml += `<a href="/del?video=${file}">del</a> | <a href="/player?video=${file}">${file}</a><br>`;
        });
        res.send(fileHtml);
    });
};

app.get("/", (req, res) => {
    // print list of video
    asyncGetAllFiles(res);
});

app.get("/del", function (req, res) {
    const range = req.headers.range;
    const videoPath = req.query.video

    console.log(videoPath);
    console.log(videoPath.replace(dir, dir_removed));

    fs.rename(videoPath, videoPath.replace(dir, dir_removed), function (err) {
        if (err) throw err
        console.log('Successfully renamed - AKA moved!')
    })

    asyncGetAllFiles(res);
});

app.get("/video", function (req, res) {
    // Ensure there is a range given for the video
    const range = req.headers.range;
    const videoPath = req.query.video
    if (!range) {
        res.status(400).send("Requires Range header");
    }

    const videoSize = fs.statSync(videoPath).size;

    const CHUNK_SIZE = 10 ** 6; // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    // Create headers
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });

    // Stream the video chunk to the client
    videoStream.pipe(res);
});

app.listen(8000, function () {
    console.log("Listening on port 8000!");
});
