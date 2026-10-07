//! 用法: cargo run --example render -- examples/first-post.ly

use std::{env, fs, process::ExitCode};

fn main() -> ExitCode {
    let Some(path) = env::args().nth(1) else {
        eprintln!("用法: render <file.ly>");
        return ExitCode::FAILURE;
    };
    let Ok(source) = fs::read_to_string(&path) else {
        eprintln!("读不到文件: {path}");
        return ExitCode::FAILURE;
    };
    let doc = lianmarkup::parse(&source);
    println!("{}", doc.html);
    println!("\n===== TOC =====\n{}", serde_json::to_string_pretty(&doc.toc).unwrap());
    println!("\n===== NOTES =====\n{}", serde_json::to_string_pretty(&doc.notes).unwrap());
    ExitCode::SUCCESS
}
