//! 把访客 User-Agent 解析成评论旁展示的短标签，如
//! 「Desktop Edge 146 · Windows 10」「Mobile Safari 17 · iOS 17」。
//! 只保留主版本号；浏览器和系统都识别不出时返回空串。

pub fn agent_label(user_agent: &str) -> String {
    let browser = browser_label(user_agent);
    let os = os_label(user_agent);
    if browser.is_none() && os.is_none() {
        return String::new();
    }
    let mut first = device_label(user_agent).to_owned();
    if let Some(browser) = browser {
        first.push(' ');
        first.push_str(&browser);
    }
    match os {
        Some(os) => format!("{first} · {os}"),
        None => first,
    }
}

fn device_label(user_agent: &str) -> &'static str {
    if user_agent.contains("iPad")
        || (user_agent.contains("Android") && !user_agent.contains("Mobile"))
    {
        "Tablet"
    } else if user_agent.contains("Mobile") || user_agent.contains("iPhone") {
        "Mobile"
    } else {
        "Desktop"
    }
}

fn major_after(user_agent: &str, token: &str) -> Option<String> {
    let start = user_agent.find(token)? + token.len();
    let major: String = user_agent[start..]
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    (!major.is_empty()).then_some(major)
}

fn browser_label(user_agent: &str) -> Option<String> {
    const BROWSERS: [(&str, &str); 8] = [
        ("EdgA/", "Edge"),
        ("EdgiOS/", "Edge"),
        ("Edg/", "Edge"),
        ("OPR/", "Opera"),
        ("FxiOS/", "Firefox"),
        ("Firefox/", "Firefox"),
        ("CriOS/", "Chrome"),
        ("Chrome/", "Chrome"),
    ];
    for (token, name) in BROWSERS {
        if let Some(major) = major_after(user_agent, token) {
            return Some(format!("{name} {major}"));
        }
    }
    if user_agent.contains("Safari/") {
        return Some(match major_after(user_agent, "Version/") {
            Some(major) => format!("Safari {major}"),
            None => "Safari".to_owned(),
        });
    }
    None
}

fn os_label(user_agent: &str) -> Option<String> {
    if let Some(start) = user_agent.find("Windows NT ") {
        let version: String = user_agent[start + "Windows NT ".len()..]
            .chars()
            .take_while(|ch| ch.is_ascii_digit() || *ch == '.')
            .collect();
        let name = match version.as_str() {
            "10.0" => "10",
            "6.3" => "8.1",
            "6.2" => "8",
            "6.1" => "7",
            other => other,
        };
        return Some(format!("Windows {name}"));
    }
    if user_agent.contains("Windows") {
        return Some("Windows".to_owned());
    }
    // iPhone/iPad 的 UA 同时含 “Mac OS X”，必须先匹配 iOS。
    for token in ["iPhone OS ", "CPU OS "] {
        if let Some(major) = major_after(user_agent, token) {
            return Some(format!("iOS {major}"));
        }
    }
    if user_agent.contains("iPhone") || user_agent.contains("iPad") {
        return Some("iOS".to_owned());
    }
    if user_agent.contains("Android") {
        return Some(match major_after(user_agent, "Android ") {
            Some(major) => format!("Android {major}"),
            None => "Android".to_owned(),
        });
    }
    if user_agent.contains("Mac OS X") {
        return Some(match major_after(user_agent, "Mac OS X ") {
            Some(major) => format!("macOS {major}"),
            None => "macOS".to_owned(),
        });
    }
    if user_agent.contains("Linux") {
        return Some("Linux".to_owned());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_desktop_agents() {
        assert_eq!(
            agent_label("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"),
            "Desktop Edge 146 · Windows 10"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"),
            "Desktop Chrome 146 · Windows 10"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0"),
            "Desktop Firefox 143 · Linux"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"),
            "Desktop Safari 17 · macOS 10"
        );
    }

    #[test]
    fn parses_mobile_and_tablet_agents() {
        assert_eq!(
            agent_label("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"),
            "Mobile Safari 17 · iOS 17"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"),
            "Tablet Safari 17 · iOS 17"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36"),
            "Mobile Chrome 146 · Android 14"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
            "Tablet Chrome 120 · Android 13"
        );
        assert_eq!(
            agent_label("Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.0.0"),
            "Mobile Edge 140 · Android 10"
        );
    }

    #[test]
    fn unparsable_agents_yield_empty_label() {
        assert_eq!(agent_label("curl/8.5.0"), "");
        assert_eq!(agent_label(""), "");
    }
}
