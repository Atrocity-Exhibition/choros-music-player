use std::path::Path;
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use walkdir::WalkDir;
use base64::{engine::general_purpose, Engine as _};
use serde::{Serialize, Deserialize};
use tauri::Manager;
use std::net::TcpListener;
use std::io::{BufRead, BufReader, Read, Write, Seek, SeekFrom};
use std::thread;
use std::fs::File;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SongMetadata {
    path: String,
    title: String,
    artist: String,
    album: String,
    genre: String,
    track: Option<u32>,
    disk: Option<u32>,
    duration: f64,
    album_artist: Option<String>,
    track_total: Option<u32>,
    disk_total: Option<u32>,
    year: Option<u32>,
    publisher: Option<String>,
    copyright: Option<String>,
    isrc: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    name: String,
    songs: Vec<SongMetadata>,
}

// ── Metadata helpers ──────────────────────────────────────────

fn parse_num_total(s: &str) -> (Option<u32>, Option<u32>) {
    let t = s.trim();
    if let Some(i) = t.find('/') {
        (t[..i].trim().parse().ok(), t[i+1..].trim().parse().ok())
    } else {
        (t.parse().ok(), None)
    }
}

fn resolve_id3_genre(raw: &str) -> String {
    const GENRES: &[&str] = &[
        "Blues","Classic Rock","Country","Dance","Disco","Funk","Grunge","Hip-Hop","Jazz","Metal",
        "New Age","Oldies","Other","Pop","R&B","Rap","Reggae","Rock","Techno","Industrial",
        "Alternative","Ska","Death Metal","Pranks","Soundtrack","Euro-Techno","Ambient","Trip-Hop",
        "Vocal","Jazz+Funk","Fusion","Trance","Classical","Instrumental","Acid","House","Game",
        "Sound Clip","Gospel","Noise","AlternRock","Bass","Soul","Punk","Space","Meditative",
        "Instrumental Pop","Instrumental Rock","Ethnic","Gothic","Darkwave","Techno-Industrial",
        "Electronic","Pop-Folk","Eurodance","Dream","Southern Rock","Comedy","Cult","Gangsta",
        "Top 40","Christian Rap","Pop/Funk","Jungle","Native American","Cabaret","New Wave",
        "Psychedelic","Rave","Showtunes","Trailer","Lo-Fi","Tribal","Acid Punk","Acid Jazz",
        "Polka","Retro","Musical","Rock & Roll","Hard Rock",
    ];
    let t = raw.trim();
    if t.starts_with('(') {
        if let Some(c) = t.find(')') {
            if let Ok(i) = t[1..c].parse::<usize>() {
                if i < GENRES.len() { return GENRES[i].to_string(); }
            }
        }
    }
    if let Ok(i) = t.parse::<usize>() {
        if i < GENRES.len() { return GENRES[i].to_string(); }
    }
    t.to_string()
}

// ── Commands ──────────────────────────────────────────────────

#[tauri::command]
async fn select_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select Music Directory")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn scan_folder(folder_path: String) -> Result<Vec<SongMetadata>, String> {
    let mut songs = Vec::new();
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory path".into());
    }

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        let fp = entry.path();
        if !fp.is_file() { continue; }
        let ext = fp.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !["mp3","m4a","flac","wav","ogg","opus"].contains(&ext.as_str()) { continue; }

        let song_path = fp.to_string_lossy().to_string();
        let stem = fp.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "Unknown".into());

        let mut title = stem;
        let mut artist = "Unknown Artist".to_string();
        let mut album  = "Unknown Album".to_string();
        let mut genre  = String::new();
        let mut track: Option<u32> = None;
        let mut track_total: Option<u32> = None;
        let mut disk: Option<u32> = None;
        let mut disk_total: Option<u32> = None;
        let mut duration = 0.0_f64;
        let mut album_artist: Option<String> = None;
        let mut year: Option<u32> = None;
        let mut publisher: Option<String> = None;
        let mut copyright: Option<String> = None;
        let mut isrc: Option<String> = None;

        let tf = (|| -> Result<_, lofty::error::LoftyError> {
            let probe = Probe::open(fp)?;
            let probe = probe.guess_file_type()?;
            probe.read()
        })();
        if let Ok(tf) = tf {
            duration = tf.properties().duration().as_secs_f64();
            if let Some(tag) = tf.primary_tag().or_else(|| tf.first_tag()) {
                if let Some(v) = tag.title()  { let v = v.trim().to_string(); if !v.is_empty() { title  = v; } }
                if let Some(v) = tag.artist() { let v = v.trim().to_string(); if !v.is_empty() { artist = v; } }
                if let Some(v) = tag.album()  { let v = v.trim().to_string(); if !v.is_empty() { album  = v; } }
                if let Some(v) = tag.genre()  { let r = resolve_id3_genre(v.trim()); if !r.is_empty() { genre = r; } }

                track = tag.track();
                track_total = tag.track_total();
                if track.is_none() || track_total.is_none() {
                    if let Some(r) = tag.get_string(&ItemKey::TrackNumber) {
                        let (n, t) = parse_num_total(r);
                        if track.is_none() { track = n; }
                        if track_total.is_none() { track_total = t; }
                    }
                }

                disk = tag.disk();
                disk_total = tag.disk_total();
                if disk.is_none() || disk_total.is_none() {
                    if let Some(r) = tag.get_string(&ItemKey::DiscNumber) {
                        let (n, t) = parse_num_total(r);
                        if disk.is_none() { disk = n; }
                        if disk_total.is_none() { disk_total = t; }
                    }
                }
                if disk_total.is_none() {
                    disk_total = tag.get_string(&ItemKey::DiscTotal).and_then(|s| s.trim().parse().ok());
                }

                year = tag.year();
                if year.is_none() {
                    year = tag.get_string(&ItemKey::Year).and_then(|s| s.trim().get(..4)).and_then(|s| s.parse().ok());
                }
                if year.is_none() {
                    year = tag.get_string(&ItemKey::RecordingDate).and_then(|s| s.trim().get(..4)).and_then(|s| s.parse().ok());
                }

                album_artist = tag.get_string(&ItemKey::AlbumArtist).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                publisher    = tag.get_string(&ItemKey::Publisher).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                if publisher.is_none() {
                    publisher = tag.get_string(&ItemKey::Label).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                }
                copyright = tag.get_string(&ItemKey::CopyrightMessage).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
                isrc      = tag.get_string(&ItemKey::Isrc).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
            }
        }

        if genre.is_empty() { genre = "Unknown Genre".to_string(); }

        songs.push(SongMetadata { path: song_path, title, artist, album, genre, track, disk,
            duration, album_artist, track_total, disk_total, year, publisher, copyright, isrc });
    }

    songs.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(songs)
}

#[tauri::command]
async fn get_cover_art(song_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&song_path);
    if !path.exists() || !path.is_file() { return Err("File does not exist".into()); }

    if let Ok(tf) = Probe::open(path)
        .map_err(|e| e.to_string())?
        .guess_file_type().map_err(|e| e.to_string())?
        .read()
    {
        if let Some(tag) = tf.primary_tag().or_else(|| tf.first_tag()) {
            if let Some(pic) = tag.pictures().first() {
                let mime = pic.mime_type().map(|m| m.to_string()).unwrap_or_else(|| "image/jpeg".into());
                return Ok(Some(format!("data:{};base64,{}", mime, general_purpose::STANDARD.encode(pic.data()))));
            }
        }
    }

    if let Some(parent) = path.parent() {
        for name in &["cover.jpg","cover.jpeg","cover.png","cover.webp","folder.jpg","folder.jpeg",
                      "folder.png","album.jpg","album.jpeg","album.png","front.jpg","front.png","artwork.jpg","artwork.png"] {
            let cp = parent.join(name);
            if cp.exists() {
                if let Ok(data) = std::fs::read(&cp) {
                    let mime = if name.ends_with(".png") { "image/png" } else if name.ends_with(".webp") { "image/webp" } else { "image/jpeg" };
                    return Ok(Some(format!("data:{};base64,{}", mime, general_purpose::STANDARD.encode(&data))));
                }
            }
        }
    }
    Ok(None)
}

#[tauri::command]
async fn get_lyrics(song_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&song_path);
    if !path.exists() || !path.is_file() { return Ok(None); }

    let tf = Probe::open(path)
        .map_err(|e| e.to_string())?
        .guess_file_type().map_err(|e| e.to_string())?
        .read().map_err(|e| e.to_string())?;

    if let Some(tag) = tf.primary_tag().or_else(|| tf.first_tag()) {
        // Try ItemKey::Lyrics (maps to USLT/ID3, LYRICS/Vorbis, ©lyr/MP4)
        if let Some(v) = tag.get_string(&ItemKey::Lyrics) {
            let v = v.trim().to_string();
            if !v.is_empty() { return Ok(Some(v)); }
        }
        // Also try the tag items directly for any lyrics-flavoured key
        for item in tag.items() {
            if let ItemKey::Unknown(k) = item.key() {
                let k_lower = k.to_lowercase();
                if k_lower.contains("lyric") || k_lower.contains("lyr") {
                    if let Some(v) = item.value().text() {
                        let v = v.trim().to_string();
                        if !v.is_empty() { return Ok(Some(v)); }
                    }
                }
            }
        }
    }
    Ok(None)
}

// ── Playlist commands ──────────────────────────────────────────

#[tauri::command]
async fn save_playlist(app_handle: tauri::AppHandle, name: String, songs: Vec<SongMetadata>) -> Result<(), String> {
    let dir = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?.join("playlists");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe: String = name.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
        .collect::<String>().trim().replace(' ', "_");
    if safe.is_empty() { return Err("Invalid playlist name".into()); }
    let file = std::fs::File::create(dir.join(format!("{}.json", safe))).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &Playlist { name, songs }).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_playlists(app_handle: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let dir = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?.join("playlists");
    if !dir.exists() { return Ok(Vec::new()); }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        if let Ok(e) = entry {
            let p = e.path();
            if p.is_file() && p.extension().map(|s| s == "json").unwrap_or(false) {
                if let Ok(f) = std::fs::File::open(&p) {
                    if let Ok(pl) = serde_json::from_reader::<_, Playlist>(f) { out.push(pl); }
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
async fn delete_playlist(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    let dir = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?.join("playlists");
    let safe: String = name.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
        .collect::<String>().trim().replace(' ', "_");
    if safe.is_empty() { return Err("Invalid playlist name".into()); }
    let fp = dir.join(format!("{}.json", safe));
    if fp.exists() { std::fs::remove_file(fp).map_err(|e| e.to_string())?; }
    Ok(())
}

// ── History commands ───────────────────────────────────────────

#[tauri::command]
async fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<SongMetadata>, String> {
    let f = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?.join("history.json");
    if !f.exists() { return Ok(Vec::new()); }
    serde_json::from_reader(std::fs::File::open(f).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_history(app_handle: tauri::AppHandle, history: Vec<SongMetadata>) -> Result<(), String> {
    let dir = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(std::fs::File::create(dir.join("history.json")).map_err(|e| e.to_string())?, &history)
        .map_err(|e| e.to_string())
}

// ── Favourites commands ────────────────────────────────────────

#[tauri::command]
async fn get_favourites(app_handle: tauri::AppHandle) -> Result<Vec<SongMetadata>, String> {
    let f = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?.join("favourites.json");
    if !f.exists() { return Ok(Vec::new()); }
    serde_json::from_reader(std::fs::File::open(f).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_favourites(app_handle: tauri::AppHandle, songs: Vec<SongMetadata>) -> Result<(), String> {
    let dir = app_handle.path().app_local_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(std::fs::File::create(dir.join("favourites.json")).map_err(|e| e.to_string())?, &songs)
        .map_err(|e| e.to_string())
}

// ── Metadata write ─────────────────────────────────────────────

#[tauri::command]
async fn update_metadata(
    path: String, title: String, artist: String, album: String, genre: String,
    track: Option<u32>, track_total: Option<u32>, disk: Option<u32>, disk_total: Option<u32>,
    year: Option<u32>, album_artist: Option<String>, publisher: Option<String>,
    copyright: Option<String>, isrc: Option<String>,
) -> Result<(), String> {
    let fp = Path::new(&path);
    if !fp.exists() || !fp.is_file() { return Err("File does not exist".into()); }

    let mut tf = Probe::open(fp).map_err(|e| e.to_string())?
        .guess_file_type().map_err(|e| e.to_string())?
        .read().map_err(|e| e.to_string())?;

    let tt = tf.primary_tag_type();
    if tf.primary_tag().is_none() && tf.first_tag().is_none() {
        tf.insert_tag(lofty::tag::Tag::new(tt));
    }
    let tag = if tf.primary_tag().is_some() { tf.primary_tag_mut().unwrap() } else { tf.first_tag_mut().unwrap() };

    tag.set_title(title); tag.set_artist(artist); tag.set_album(album); tag.set_genre(genre);
    match track       { Some(v) => tag.set_track(v),       None => tag.remove_track() }
    match track_total { Some(v) => tag.set_track_total(v), None => tag.remove_track_total() }
    match disk        { Some(v) => tag.set_disk(v),        None => tag.remove_disk() }
    match disk_total  { Some(v) => { tag.insert_text(ItemKey::DiscTotal, v.to_string()); }, None => { tag.remove_key(&ItemKey::DiscTotal); } }
    match year        { Some(v) => tag.set_year(v),        None => tag.remove_year() }
    match album_artist { Some(v) if !v.is_empty() => { tag.insert_text(ItemKey::AlbumArtist, v); }, _ => { tag.remove_key(&ItemKey::AlbumArtist); } }
    match publisher    { Some(v) if !v.is_empty() => { tag.insert_text(ItemKey::Publisher, v); },   _ => { tag.remove_key(&ItemKey::Publisher); } }
    match copyright    { Some(v) if !v.is_empty() => { tag.insert_text(ItemKey::CopyrightMessage, v); }, _ => { tag.remove_key(&ItemKey::CopyrightMessage); } }
    match isrc         { Some(v) if !v.is_empty() => { tag.insert_text(ItemKey::Isrc, v); }, _ => { tag.remove_key(&ItemKey::Isrc); } }

    tf.save_to_path(fp, lofty::config::WriteOptions::default()).map_err(|e| e.to_string())
}

// ── HTTP Media Server ──────────────────────────────────────────

struct StreamPort(u16);

fn url_decode(s: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next().unwrap_or(b'0') as char;
            let h2 = chars.next().unwrap_or(b'0') as char;
            if let Ok(p) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) { bytes.push(p); }
        } else if b == b'+' { bytes.push(b' ');
        } else { bytes.push(b); }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn ext_mime(fp: &Path) -> &'static str {
    match fp.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()).as_deref() {
        Some("flac") => "audio/flac",
        Some("ogg") | Some("opus") => "audio/ogg",
        Some("m4a") | Some("aac") => "audio/mp4",
        Some("wav") => "audio/wav",
        _ => "audio/mpeg",
    }
}

fn serve_cover(stream: &mut std::net::TcpStream, fp: &Path) -> bool {
    let tf = (|| -> Result<_, lofty::error::LoftyError> {
        let probe = Probe::open(fp)?;
        let probe = probe.guess_file_type()?;
        probe.read()
    })();
    if let Ok(probe) = tf {
        if let Some(tag) = probe.primary_tag().or_else(|| probe.first_tag()) {
            if let Some(pic) = tag.pictures().first() {
                let mime = pic.mime_type().map(|m| m.to_string()).unwrap_or_else(|| "image/jpeg".into());
                let data = pic.data();
                let hdr = format!("HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: max-age=86400\r\n\r\n", mime, data.len());
                if stream.write_all(hdr.as_bytes()).is_ok() { let _ = stream.write_all(data); }
                return true;
            }
        }
    }
    if let Some(parent) = fp.parent() {
        for name in &["cover.jpg","cover.jpeg","cover.png","cover.webp","folder.jpg","folder.jpeg",
                      "folder.png","album.jpg","album.png","front.jpg","front.png","artwork.jpg","artwork.png"] {
            let cp = parent.join(name);
            if cp.exists() {
                if let Ok(data) = std::fs::read(&cp) {
                    let mime = if name.ends_with(".png") { "image/png" } else if name.ends_with(".webp") { "image/webp" } else { "image/jpeg" };
                    let hdr = format!("HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: max-age=86400\r\n\r\n", mime, data.len());
                    if stream.write_all(hdr.as_bytes()).is_ok() { let _ = stream.write_all(&data); }
                    return true;
                }
            }
        }
    }
    false
}

fn start_media_server() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind failed");
    let port = listener.local_addr().unwrap().port();

    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                thread::spawn(move || {
                    let mut reader = BufReader::new(unsafe { &mut *(&mut stream as *mut std::net::TcpStream) });
                    let mut first_line = String::new();
                    if reader.read_line(&mut first_line).is_err() { return; }
                    let parts: Vec<&str> = first_line.split_whitespace().collect();
                    if parts.len() < 2 || parts[0] != "GET" { return; }
                    let url = parts[1];

                    if url.starts_with("/cover") {
                        if let Some(i) = url.find("?path=") {
                            let fp_str = url_decode(&url[i+6..]);
                            let fp = Path::new(&fp_str);
                            if fp.exists() && fp.is_file() && serve_cover(&mut stream, fp) { return; }
                        }
                        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\n\r\n");
                        return;
                    }

                    if let Some(i) = url.find("?path=") {
                        let fp_str = url_decode(&url[i+6..]);
                        let fp = Path::new(&fp_str);
                        if fp.exists() && fp.is_file() {
                            let mut range_hdr: Option<String> = None;
                            loop {
                                let mut line = String::new();
                                if reader.read_line(&mut line).is_err() || line.trim().is_empty() { break; }
                                if line.to_lowercase().starts_with("range:") { range_hdr = Some(line.trim().into()); }
                            }
                            if let Ok(mut file) = File::open(fp) {
                                if let Ok(meta) = file.metadata() {
                                    let sz = meta.len();
                                    let mime = ext_mime(fp);
                                    if let Some(rng) = range_hdr {
                                        if let Some(bi) = rng.find("bytes=") {
                                            let rv = rng[bi+6..].trim();
                                            let rp: Vec<&str> = rv.split('-').collect();
                                            let start: u64 = rp[0].parse().unwrap_or(0);
                                            let end: u64 = if rp.len() > 1 && !rp[1].is_empty() { rp[1].parse().unwrap_or(sz-1) } else { sz-1 };
                                            if start < sz {
                                                let chunk = end - start + 1;
                                                let hdr = format!("HTTP/1.1 206 Partial Content\r\nContent-Type: {}\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\n\r\n", mime, chunk, start, end, sz);
                                                if file.seek(SeekFrom::Start(start)).is_ok() && stream.write_all(hdr.as_bytes()).is_ok() {
                                                    let mut rem = chunk; let mut buf = [0u8; 65536];
                                                    while rem > 0 {
                                                        let n = rem.min(buf.len() as u64) as usize;
                                                        match file.read(&mut buf[..n]) {
                                                            Ok(0) => break,
                                                            Ok(r) => { if stream.write_all(&buf[..r]).is_err() { break; } rem -= r as u64; }
                                                            Err(_) => break,
                                                        }
                                                    }
                                                }
                                                return;
                                            }
                                        }
                                    }
                                    let hdr = format!("HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\n\r\n", mime, sz);
                                    if stream.write_all(hdr.as_bytes()).is_ok() {
                                        let mut buf = [0u8; 65536];
                                        loop { match file.read(&mut buf) { Ok(0) => break, Ok(n) => { if stream.write_all(&buf[..n]).is_err() { break; } } Err(_) => break } }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    });
    port
}

#[tauri::command]
fn get_stream_port(state: tauri::State<'_, StreamPort>) -> u16 { state.0 }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
    tauri::Builder::default()
        .setup(|app| {
            let port = start_media_server();
            app.manage(StreamPort(port));
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_folder, scan_folder, get_cover_art, get_lyrics,
            save_playlist, get_playlists, delete_playlist,
            get_history, save_history,
            get_favourites, save_favourites,
            get_stream_port, update_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
