use std::path::Path;
use lofty::prelude::*;
use lofty::probe::Probe;
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
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Playlist {
    name: String,
    songs: Vec<SongMetadata>,
}

#[tauri::command]
fn select_folder() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Music Directory")
        .pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<SongMetadata>, String> {
    let mut songs = Vec::new();
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory path".into());
    }

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        let file_path = entry.path();
        if file_path.is_file() {
            if let Some(ext) = file_path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ["mp3", "m4a", "flac", "wav", "ogg", "opus"].contains(&ext_str.as_str()) {
                    let song_path = file_path.to_string_lossy().to_string();
                    let file_name = file_path.file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Unknown Track".to_string());

                    let mut title = file_name;
                    let mut artist = "Unknown Artist".to_string();
                    let mut album = "Unknown Album".to_string();
                    let mut genre = "Unknown Genre".to_string();
                    let mut track = None;
                    let mut disk = None;
                    let mut duration = 0.0;

                    // Parse metadata with lofty
                    let parse_result = Probe::open(file_path)
                        .map_err(|e| e.to_string())
                        .and_then(|p| p.guess_file_type().map_err(|e| e.to_string()))
                        .and_then(|p| p.read().map_err(|e| e.to_string()));

                    if let Ok(tagged_file) = parse_result {
                        duration = tagged_file.properties().duration().as_secs_f64();
                        
                        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                            if let Some(t) = tag.title() {
                                if !t.trim().is_empty() {
                                    title = t.to_string();
                                }
                            }
                            if let Some(a) = tag.artist() {
                                if !a.trim().is_empty() {
                                    artist = a.to_string();
                                }
                            }
                            if let Some(al) = tag.album() {
                                if !al.trim().is_empty() {
                                    album = al.to_string();
                                }
                            }
                            if let Some(g) = tag.genre() {
                                if !g.trim().is_empty() {
                                    genre = g.to_string();
                                }
                            }
                            track = tag.track();
                            disk = tag.disk();
                        }
                    }

                    songs.push(SongMetadata {
                        path: song_path,
                        title,
                        artist,
                        album,
                        genre,
                        track,
                        disk,
                        duration,
                    });
                }
            }
        }
    }

    Ok(songs)
}

#[tauri::command]
fn get_cover_art(song_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&song_path);
    if !path.exists() || !path.is_file() {
        return Err("File does not exist".into());
    }

    // 1. Try to get embedded cover art
    if let Ok(tagged_file) = Probe::open(path)
        .map_err(|e| e.to_string())?
        .guess_file_type()
        .map_err(|e| e.to_string())?
        .read() {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            if let Some(picture) = tag.pictures().first() {
                let encoded = general_purpose::STANDARD.encode(picture.data());
                let mime_type = picture.mime_type()
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "image/jpeg".to_string());
                return Ok(Some(format!("data:{};base64,{}", mime_type, encoded)));
            }
        }
    }

    // 2. Fallback: check directory files in the same directory
    if let Some(parent) = path.parent() {
        let cover_filenames = ["cover.jpg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png"];
        for filename in cover_filenames.iter() {
            let cover_path = parent.join(filename);
            if cover_path.exists() && cover_path.is_file() {
                if let Ok(data) = std::fs::read(&cover_path) {
                    let mime_type = if filename.ends_with(".png") { "image/png" } else { "image/jpeg" };
                    let encoded = general_purpose::STANDARD.encode(&data);
                    return Ok(Some(format!("data:{};base64,{}", mime_type, encoded)));
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
fn save_playlist(app_handle: tauri::AppHandle, name: String, songs: Vec<SongMetadata>) -> Result<(), String> {
    let app_dir = app_handle.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    
    let playlists_dir = app_dir.join("playlists");
    std::fs::create_dir_all(&playlists_dir).map_err(|e| e.to_string())?;
    
    let safe_name: String = name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if safe_name.is_empty() {
        return Err("Invalid playlist name".to_string());
    }
    let file_path = playlists_dir.join(format!("{}.json", safe_name));
    
    let playlist = Playlist {
        name: name.clone(),
        songs,
    };
    
    let file = std::fs::File::create(file_path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &playlist).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_playlists(app_handle: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let app_dir = app_handle.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    
    let playlists_dir = app_dir.join("playlists");
    if !playlists_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut playlists = Vec::new();
    for entry in std::fs::read_dir(playlists_dir).map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().map(|s| s == "json").unwrap_or(false) {
                if let Ok(file) = std::fs::File::open(&path) {
                    if let Ok(playlist) = serde_json::from_reader::<_, Playlist>(file) {
                        playlists.push(playlist);
                    }
                }
            }
        }
    }
    
    Ok(playlists)
}

#[tauri::command]
fn delete_playlist(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    
    let playlists_dir = app_dir.join("playlists");
    let safe_name: String = name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    if safe_name.is_empty() {
        return Err("Invalid playlist name".to_string());
    }
    let file_path = playlists_dir.join(format!("{}.json", safe_name));
    
    if file_path.exists() {
        std::fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<SongMetadata>, String> {
    let app_dir = app_handle.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    
    let history_file = app_dir.join("history.json");
    if !history_file.exists() {
        return Ok(Vec::new());
    }
    
    let file = std::fs::File::open(history_file).map_err(|e| e.to_string())?;
    let history = serde_json::from_reader::<_, Vec<SongMetadata>>(file).map_err(|e| e.to_string())?;
    
    Ok(history)
}

#[tauri::command]
fn save_history(app_handle: tauri::AppHandle, history: Vec<SongMetadata>) -> Result<(), String> {
    let app_dir = app_handle.path().app_local_data_dir()
        .map_err(|e| e.to_string())?;
    
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let history_file = app_dir.join("history.json");
    
    let file = std::fs::File::create(history_file).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(file, &history).map_err(|e| e.to_string())?;
    
    Ok(())
}

struct StreamPort(u16);

fn url_decode(op: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = op.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next().unwrap_or(b'0') as char;
            let h2 = chars.next().unwrap_or(b'0') as char;
            let hex = format!("{}{}", h1, h2);
            if let Ok(parsed) = u8::from_str_radix(&hex, 16) {
                bytes.push(parsed);
            }
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn start_media_server() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind local stream server");
    let port = listener.local_addr().unwrap().port();
    
    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                thread::spawn(move || {
                    let mut reader = BufReader::new(&mut stream);
                    let mut first_line = String::new();
                    if reader.read_line(&mut first_line).is_err() { return; }
                    
                    let parts: Vec<&str> = first_line.split_whitespace().collect();
                    if parts.len() < 2 || parts[0] != "GET" { return; }
                    
                    let url_path = parts[1];
                    if url_path.starts_with("/cover") {
                        if let Some(query_idx) = url_path.find("?path=") {
                            let encoded_path = &url_path[query_idx + 6..];
                            let decoded = url_decode(encoded_path);
                            let file_path = Path::new(&decoded);
                            
                            if file_path.exists() && file_path.is_file() {
                                // 1. Try to get embedded cover art
                                if let Ok(tagged_file) = Probe::open(file_path)
                                    .map_err(|e| e.to_string())
                                    .and_then(|p| p.guess_file_type().map_err(|e| e.to_string()))
                                    .and_then(|p| p.read().map_err(|e| e.to_string())) {
                                    if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                                        if let Some(picture) = tag.pictures().first() {
                                            let mime_type = picture.mime_type()
                                                .map(|m| m.to_string())
                                                .unwrap_or_else(|| "image/jpeg".to_string());
                                            let data = picture.data();
                                            let response = format!(
                                                "HTTP/1.1 200 OK\r\n\
                                                 Content-Type: {}\r\n\
                                                 Content-Length: {}\r\n\
                                                 Access-Control-Allow-Origin: *\r\n\r\n",
                                                mime_type, data.len()
                                            );
                                            if stream.write_all(response.as_bytes()).is_ok() {
                                                let _ = stream.write_all(data);
                                            }
                                            return;
                                        }
                                    }
                                }

                                // 2. Fallback: check directory files in the same directory
                                if let Some(parent) = file_path.parent() {
                                    let cover_filenames = ["cover.jpg", "cover.png", "folder.jpg", "folder.png", "album.jpg", "album.png"];
                                    for filename in cover_filenames.iter() {
                                        let cover_path = parent.join(filename);
                                        if cover_path.exists() && cover_path.is_file() {
                                            if let Ok(data) = std::fs::read(&cover_path) {
                                                let mime_type = if filename.ends_with(".png") { "image/png" } else { "image/jpeg" };
                                                let response = format!(
                                                    "HTTP/1.1 200 OK\r\n\
                                                     Content-Type: {}\r\n\
                                                     Content-Length: {}\r\n\
                                                     Access-Control-Allow-Origin: *\r\n\r\n",
                                                    mime_type, data.len()
                                                );
                                                if stream.write_all(response.as_bytes()).is_ok() {
                                                    let _ = stream.write_all(&data);
                                                }
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Default 404 response
                        let response = "HTTP/1.1 404 Not Found\r\n\
                                        Content-Length: 0\r\n\
                                        Access-Control-Allow-Origin: *\r\n\r\n";
                        let _ = stream.write_all(response.as_bytes());
                        return;
                    }

                    if let Some(query_idx) = url_path.find("?path=") {
                        let encoded_path = &url_path[query_idx + 6..];
                        let decoded = url_decode(encoded_path);
                        let file_path = Path::new(&decoded);
                        
                        if file_path.exists() && file_path.is_file() {
                            let mut range_header = None;
                            loop {
                                let mut line = String::new();
                                if reader.read_line(&mut line).is_err() || line.trim().is_empty() {
                                    break;
                                }
                                if line.to_lowercase().starts_with("range:") {
                                    range_header = Some(line);
                                }
                            }
                            
                            if let Ok(mut file) = File::open(file_path) {
                                if let Ok(metadata) = file.metadata() {
                                    let file_size = metadata.len();
                                    let mime = if file_path.extension().map(|s| s == "flac").unwrap_or(false) {
                                        "audio/flac"
                                    } else if file_path.extension().map(|s| s == "ogg" || s == "opus").unwrap_or(false) {
                                        "audio/ogg"
                                    } else if file_path.extension().map(|s| s == "m4a").unwrap_or(false) {
                                        "audio/mp4"
                                    } else if file_path.extension().map(|s| s.eq_ignore_ascii_case("wav")).unwrap_or(false) {
                                        "audio/wav"
                                    } else {
                                        "audio/mpeg"
                                    };
                                    
                                    if let Some(range) = range_header {
                                        if let Some(bytes_idx) = range.find("bytes=") {
                                            let range_val = range[bytes_idx + 6..].trim();
                                            let r_parts: Vec<&str> = range_val.split('-').collect();
                                            let start: u64 = r_parts[0].parse().unwrap_or(0);
                                            let end: u64 = if r_parts.len() > 1 && !r_parts[1].is_empty() {
                                                r_parts[1].parse().unwrap_or(file_size - 1)
                                            } else {
                                                file_size - 1
                                            };
                                            
                                            if start < file_size {
                                                let chunk_size = end - start + 1;
                                                if file.seek(SeekFrom::Start(start)).is_ok() {
                                                    let response = format!(
                                                        "HTTP/1.1 206 Partial Content\r\n\
                                                         Content-Type: {}\r\n\
                                                         Content-Length: {}\r\n\
                                                         Content-Range: bytes {}-{}/{}\r\n\
                                                         Accept-Ranges: bytes\r\n\
                                                         Access-Control-Allow-Origin: *\r\n\r\n",
                                                        mime, chunk_size, start, end, file_size
                                                    );
                                                    if stream.write_all(response.as_bytes()).is_ok() {
                                                        let mut remaining = chunk_size;
                                                        let mut buf = [0; 65536];
                                                        while remaining > 0 {
                                                            let to_read = std::cmp::min(remaining, buf.len() as u64) as usize;
                                                            if let Ok(bytes_read) = file.read(&mut buf[..to_read]) {
                                                                if bytes_read == 0 { break; }
                                                                if stream.write_all(&buf[..bytes_read]).is_err() { break; }
                                                                remaining -= bytes_read as u64;
                                                            } else {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                    
                                    let response = format!(
                                        "HTTP/1.1 200 OK\r\n\
                                         Content-Type: {}\r\n\
                                         Content-Length: {}\r\n\
                                         Accept-Ranges: bytes\r\n\
                                         Access-Control-Allow-Origin: *\r\n\r\n",
                                        mime, file_size
                                    );
                                    if stream.write_all(response.as_bytes()).is_ok() {
                                        let mut buf = [0; 65536];
                                        while let Ok(bytes_read) = file.read(&mut buf) {
                                            if bytes_read == 0 { break; }
                                            if stream.write_all(&buf[..bytes_read]).is_err() { break; }
                                        }
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
fn get_stream_port(state: tauri::State<'_, StreamPort>) -> u16 {
    state.0
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "linux")]
  {
    // Fix WebKitGTK GPU acceleration crash on Wayland/Hyprland with Nvidia/hybrid GPUs
    if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
      std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
  }

  tauri::Builder::default()
    .setup(|app| {
      let port = start_media_server();
      app.manage(StreamPort(port));

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      select_folder, 
      scan_folder, 
      get_cover_art,
      save_playlist,
      get_playlists,
      delete_playlist,
      get_history,
      save_history,
      get_stream_port
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
