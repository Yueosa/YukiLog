//! 用法: cargo run -p yukilog-server --example render-ly -- <file.ly>
//! 把 .ly 文章走完整服务端渲染管线（lianmarkup + syntect + ammonia）输出 HTML

fn main() {
    let path = std::env::args().nth(1).expect("用法: render-ly <file.ly>");
    let source = std::fs::read_to_string(&path).expect("读不到文件");
    let rendered = yukilog_server::markup::render(&source);
    println!("{}", rendered.html);
    println!("\n===== HEADINGS =====\n{}", serde_json::to_string_pretty(&rendered.headings).unwrap());
    println!("\n===== NOTES =====\n{}", serde_json::to_string_pretty(&rendered.notes).unwrap());
}
