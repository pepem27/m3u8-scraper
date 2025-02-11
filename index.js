const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Servidor funcionando. Usa /scrape?url=...");
});

app.get("/scrape", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send("Falta el parámetro 'url'.");

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    try {
        console.log("Cargando página...");
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        console.log("Esperando el iframe...");
        await page.waitForSelector("iframe", { timeout: 20000 });

        const iframeSrc = await page.evaluate(() => {
            const iframe = document.querySelector("iframe");
            return iframe ? iframe.src : null;
        });

        if (!iframeSrc) {
            await browser.close();
            return res.status(404).send({ error: "No se encontró el iframe." });
        }

        console.log("Iframe detectado:", iframeSrc);
        const iframePage = await browser.newPage();
        await iframePage.goto(iframeSrc, { waitUntil: "networkidle2", timeout: 60000 });

        console.log("Buscando enlace M3U8...");
        const m3u8Url = await iframePage.evaluate(() => {
            const scripts = document.querySelectorAll("script");
            for (let script of scripts) {
                const match = script.innerText.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
                if (match) {
                    return match[1];
                }
            }
            return null;
        });

        await browser.close();

        if (!m3u8Url) {
            return res.status(404).send({ error: "No se encontró el enlace M3U8 con token." });
        }

        console.log("Enlace M3U8 encontrado:", m3u8Url);
        res.json({ m3u8: m3u8Url });

    } catch (error) {
        await browser.close();
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
