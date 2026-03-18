/**
 * Replace the old scanner video on YouTube:
 * 1. Delete the old video
 * 2. Upload the new one to the same playlist
 */
import { readFileSync, writeFileSync, existsSync, createReadStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOT_DIR = "/Users/marketwatchxyz/GolandProjects/claude-discord-bot/scanner-video";
const CREDENTIALS_PATH = join(BOT_DIR, "youtube-credentials.json");
const TOKEN_PATH = join(BOT_DIR, "youtube-token.json");

const OLD_VIDEO_ID = process.argv[2] || "grt72ol2mXQ";
const VIDEO_PATH = process.argv[3] || join(__dirname, "../output/scanner-20260317-v2.mp4");
const THUMB_PATH = join(__dirname, "../output/frame-intro.png");

async function main() {
  const { google } = await import("googleapis");

  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"));
  const token = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || "http://localhost");
  oauth2.setCredentials(token);

  // Refresh if needed
  if (token.expiry_date && Date.now() > token.expiry_date) {
    const { credentials: newCreds } = await oauth2.refreshAccessToken();
    writeFileSync(TOKEN_PATH, JSON.stringify(newCreds, null, 2));
    oauth2.setCredentials(newCreds);
  }

  const youtube = google.youtube({ version: "v3", auth: oauth2 });

  // 1. Delete old video
  console.log(`[YT] Deleting old video ${OLD_VIDEO_ID}...`);
  try {
    await youtube.videos.delete({ id: OLD_VIDEO_ID });
    console.log("[YT] Old video deleted.");
  } catch (err) {
    console.warn(`[YT] Delete failed (may not exist): ${err.message?.slice(0, 80)}`);
  }

  // 2. Build scan data for title/description
  const data = JSON.parse(readFileSync(join(__dirname, "../public/data.json"), "utf8"));
  const scanData = {
    date: data.date,
    regime: data.regime,
    setupCount: data.setups.length,
    setups: data.setups.map(s => ({
      ticker: s.ticker,
      companyName: s.name,
      score: s.score,
      grade: s.score >= 90 ? "A+" : s.score >= 85 ? "A" : "B+",
      strategy: s.badges?.[1] || "Momentum",
      entry: s.levels.entry,
      stop: s.levels.stop,
      tp1: s.levels.target1,
      tp2: s.levels.target2,
      rr: s.levels["r/r"],
    })),
  };

  const topPick = scanData.setups.reduce((a, b) => a.score > b.score ? a : b);
  const top3 = scanData.setups.slice(0, 3).map(s => s.ticker).join(", ");
  const allTickers = scanData.setups.map(s => s.ticker).join(", ");

  const title = `${topPick.ticker} Could EXPLODE — ${scanData.setupCount} Trades You NEED to See (${scanData.regime})`;

  const description = `🔍 Daily Market Scanner — ${data.date}
📊 Regime: ${data.regime}
⚡ ${scanData.setupCount} A+ Setups Identified

${scanData.setups.map((s, i) => `${i + 1}. ${s.ticker} (${s.companyName}) — Score ${s.score}/100, Grade ${s.grade}
   Entry: ${s.entry} | Stop: ${s.stop} | TP1: ${s.tp1} | R/R: ${s.rr}`).join("\n")}

📈 Scanner Performance (22 scans, 280 setups):
• Cumulative Hit Rate: 41%
• Best Pick All-Time: ACMR +147%
• Grade: B

🌐 Full Analysis: https://articles.market-watch.xyz/scanner/20260317/
🔔 Subscribe for daily scanner videos!

⚠️ DISCLAIMER: This is NOT financial advice. Past performance does not guarantee future results. Always do your own research and manage your risk. The information presented is for educational and entertainment purposes only.

#stocks #trading #investing #marketscanner #${allTickers.replace(/, /g, " #")}`;

  const tags = [
    "stocks", "trading", "investing", "market scanner", "stock market",
    "trade setups", "technical analysis", data.regime.toLowerCase(),
    ...scanData.setups.map(s => s.ticker),
    ...scanData.setups.map(s => s.companyName),
    "market-watch.xyz", "algorithmic trading", "swing trading",
  ];

  console.log(`[YT] Uploading: ${title}`);

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description,
        tags,
        categoryId: "27",
        defaultLanguage: "en",
        defaultAudioLanguage: "en",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
        license: "youtube",
        embeddable: true,
        publicStatsViewable: true,
      },
    },
    media: {
      body: createReadStream(VIDEO_PATH),
    },
  });

  const videoId = res.data.id;
  console.log(`[YT] Uploaded: https://youtu.be/${videoId}`);

  // Set thumbnail
  if (existsSync(THUMB_PATH)) {
    try {
      await youtube.thumbnails.set({ videoId, media: { body: createReadStream(THUMB_PATH) } });
      console.log("[YT] Thumbnail set");
    } catch (err) {
      console.warn(`[YT] Thumbnail failed: ${err.message?.slice(0, 60)}`);
    }
  }

  // Add to playlist
  try {
    const playlistTitle = "Daily Market Scanner";
    const playlists = await youtube.playlists.list({ part: ["snippet"], mine: true, maxResults: 50 });
    let playlistId = playlists.data.items?.find(p => p.snippet.title === playlistTitle)?.id;

    if (!playlistId) {
      const pl = await youtube.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: { title: playlistTitle, description: "Daily algorithmic market scanner — trade setups identified by our quantitative models. Not financial advice." },
          status: { privacyStatus: "public" },
        },
      });
      playlistId = pl.data.id;
      console.log(`[YT] Created playlist: ${playlistId}`);
    }

    await youtube.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
      },
    });
    console.log("[YT] Added to playlist: Daily Market Scanner");
  } catch (err) {
    console.warn(`[YT] Playlist error: ${err.message?.slice(0, 60)}`);
  }

  console.log(`\n✅ Done! New video: https://youtu.be/${videoId}`);
}

main().catch(err => { console.error(err); process.exit(1); });
