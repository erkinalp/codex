
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose};
use std::io::Write;
use crate::error::Result;
use crate::error::CodexErr;
use mime_guess::from_path;
use serde_json::json;
use tracing::debug;

pub fn file_to_data_url(path: &Path) -> Result<String> {
    let file_content = std::fs::read(path)?;
    let encoded = general_purpose::STANDARD.encode(&file_content);
    
    let mime_type = from_path(path)
        .first_or_octet_stream()
        .to_string();
    
    Ok(format!("data:{};base64,{}", mime_type, encoded))
}

pub fn file_to_attachment(path: &Path) -> Result<serde_json::Value> {
    let data_url = file_to_data_url(path)?;
    let filename = path.file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CodexErr::Other("Invalid file name".to_string()))?;
    
    Ok(json!({
        "type": "file",
        "name": filename,
        "content": data_url
    }))
}

pub fn files_to_attachments(paths: &[PathBuf]) -> Result<Vec<serde_json::Value>> {
    let mut attachments = Vec::with_capacity(paths.len());
    
    for path in paths {
        let attachment = file_to_attachment(path)?;
        attachments.push(attachment);
    }
    
    Ok(attachments)
}

pub fn save_data_url_to_file(data_url: &str, filename: &str, save_dir: &Path) -> Result<PathBuf> {
    debug!("Saving data URL to file: {}", filename);
    
    let parts: Vec<&str> = data_url.split(';').collect();
    if parts.len() < 2 {
        return Err(CodexErr::Other(format!("Invalid data URL format: {}", data_url)));
    }
    
    let mime_parts: Vec<&str> = parts[0].split(':').collect();
    if mime_parts.len() < 2 {
        return Err(CodexErr::Other(format!("Invalid MIME type in data URL: {}", data_url)));
    }
    
    let base64_parts: Vec<&str> = parts[1].split(',').collect();
    if base64_parts.len() < 2 {
        return Err(CodexErr::Other(format!("Invalid base64 data in data URL: {}", data_url)));
    }
    
    let decoded = general_purpose::STANDARD.decode(base64_parts[1])?;
    
    std::fs::create_dir_all(save_dir)?;
    
    let file_path = save_dir.join(filename);
    
    let mut file = std::fs::File::create(&file_path)?;
    file.write_all(&decoded)?;
    
    debug!("Saved attachment to: {:?}", file_path);
    
    Ok(file_path)
}

pub fn process_attachment(attachment: &serde_json::Value, save_dir: &Path) -> Result<PathBuf> {
    let content = attachment["content"].as_str()
        .ok_or_else(|| CodexErr::Other("Attachment missing content field".to_string()))?;
    
    let filename = attachment["name"].as_str()
        .ok_or_else(|| CodexErr::Other("Attachment missing name field".to_string()))?;
    
    save_data_url_to_file(content, filename, save_dir)
}

pub fn process_attachments(attachments: &[serde_json::Value], save_dir: &Path) -> Result<Vec<PathBuf>> {
    let mut file_paths = Vec::with_capacity(attachments.len());
    
    for attachment in attachments {
        let file_path = process_attachment(attachment, save_dir)?;
        file_paths.push(file_path);
    }
    
    Ok(file_paths)
}

pub fn default_attachment_dir() -> PathBuf {
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home_dir.join(".codex").join("attachments")
}
