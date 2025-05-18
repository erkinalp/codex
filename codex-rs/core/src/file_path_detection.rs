


use std::path::{Path, PathBuf};
use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    static ref UNIX_PATH_REGEX: Regex = Regex::new(r"/[a-zA-Z0-9_.-/]+").unwrap();
    static ref RELATIVE_PATH_REGEX: Regex = Regex::new(r"\./[a-zA-Z0-9_.-/]+").unwrap();
    static ref HOME_PATH_REGEX: Regex = Regex::new(r"~/[a-zA-Z0-9_.-/]+").unwrap();
    static ref WINDOWS_PATH_REGEX: Regex = Regex::new(r"[A-Za-z]:\\[a-zA-Z0-9_.-\\]+").unwrap();
    static ref URL_REGEX: Regex = Regex::new(r"https?://[\w\./\?\-_%&=]+").unwrap();
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilePathHandlingOption {
    Upload,
    ProcessLocally,
    Cancel,
}

#[derive(Debug, Clone)]
pub struct FilePathDetectionResult {
    pub original_input: String,
    pub detected_paths: Vec<PathBuf>,
    pub handling_option: Option<FilePathHandlingOption>,
}

pub fn detect_local_file_paths(input: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    let input_without_urls = URL_REGEX.replace_all(input, "");
    let input_str = input_without_urls.as_ref();
    
    for capture in UNIX_PATH_REGEX.captures_iter(input_str) {
        let path_str = capture.get(0).unwrap().as_str().trim_matches(|c| " '\"()".contains(c));
        let path = PathBuf::from(path_str);
        
        if path.exists() && path.is_file() {
            paths.push(path);
        }
    }
    
    for capture in RELATIVE_PATH_REGEX.captures_iter(input_str) {
        let path_str = capture.get(0).unwrap().as_str().trim_matches(|c| " '\"()".contains(c));
        let path = PathBuf::from(path_str);
        
        if path.exists() && path.is_file() {
            paths.push(path);
        }
    }
    
    for capture in HOME_PATH_REGEX.captures_iter(input_str) {
        let path_str = capture.get(0).unwrap().as_str().trim_matches(|c| " '\"()".contains(c));
        
        if let Some(home) = dirs::home_dir() {
            let path_str = path_str.strip_prefix('~').unwrap_or(path_str);
            let path = home.join(path_str.strip_prefix('/').unwrap_or(path_str));
            
            if path.exists() && path.is_file() {
                paths.push(path);
            }
        }
    }
    
    for capture in WINDOWS_PATH_REGEX.captures_iter(input_str) {
        let path_str = capture.get(0).unwrap().as_str().trim_matches(|c| " '\"()".contains(c));
        let path = PathBuf::from(path_str);
        
        if path.exists() && path.is_file() {
            paths.push(path);
        }
    }
    
    paths
}

pub fn substitute_file_paths_with_urls(
    input: &str,
    path_url_map: &[(PathBuf, String)],
) -> String {
    let mut result = input.to_string();
    
    let mut path_positions: Vec<(usize, usize, &PathBuf, &String)> = Vec::new();
    
    for (path, url) in path_url_map {
        let path_str = path.to_string_lossy();
        
        let mut start_idx = 0;
        while let Some(pos) = result[start_idx..].find(&path_str) {
            let abs_pos = start_idx + pos;
            path_positions.push((abs_pos, abs_pos + path_str.len(), path, url));
            start_idx = abs_pos + 1;
        }
    }
    
    path_positions.sort_by(|a, b| b.0.cmp(&a.0));
    
    for (start, end, _, url) in path_positions {
        result.replace_range(start..end, url);
    }
    
    result
}

pub fn prompt_for_file_path_handling(paths: &[PathBuf]) -> FilePathHandlingOption {
    FilePathHandlingOption::Upload
}

pub fn should_process_remotely(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    
    match std::fs::metadata(path) {
        Ok(metadata) => {
            metadata.len() < 10 * 1024 * 1024
        }
        Err(_) => false,
    }
}
