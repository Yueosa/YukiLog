import arrowUp from "../assets/icon/ui/arrow-up.svg?raw";
import arrow from "../assets/icon/ui/arrow.svg?raw";
import envelope from "../assets/icon/ui/envelope.svg?raw";
import close from "../assets/icon/ui/close.svg?raw";
import eye from "../assets/icon/ui/eye.svg?raw";
import clock from "../assets/icon/ui/clock.svg?raw";
import chevronRight from "../assets/icon/ui/chevron-right.svg?raw";
import githubMark from "../assets/icon/ui/github-mark.svg?raw";
import arrowRightLine from "../assets/icon/ui/arrow-right-line.svg?raw";
import folderOpen from "../assets/icon/ui/folder-open.svg?raw";
import refreshCcw from "../assets/icon/ui/refresh-ccw.svg?raw";
import search from "../assets/icon/ui/search.svg?raw";
import openingQuotationMark from "../assets/icon/ui/opening-quotation-mark.svg?raw";
import closingQuotationMark from "../assets/icon/ui/closing-quotation-mark.svg?raw";
import cake from "../assets/icon/ui/cake.svg?raw";
import wordCount from "../assets/icon/ui/word-count.svg?raw";

import navHome from "../assets/icon/nav/home.svg?raw";
import navTheme from "../assets/icon/nav/theme.svg?raw";
import navArchive from "../assets/icon/nav/archive.svg?raw";
import navTag from "../assets/icon/nav/tag.svg?raw";
import navLinks from "../assets/icon/nav/links.svg?raw";
import navAbout from "../assets/icon/nav/about.svg?raw";
import navNotes from "../assets/icon/nav/notes.svg?raw";

import socialGithub from "../assets/icon/social/github.svg?raw";
import socialQq from "../assets/icon/social/qq.svg?raw";
import socialBilibili from "../assets/icon/social/bilibili.svg?raw";
import socialX from "../assets/icon/social/x.svg?raw";
import socialNeteaseMusic from "../assets/icon/social/cloudmusic.svg?raw";
import socialGmail from "../assets/icon/social/gmail.svg?raw";

export const uiIcons = {
  arrowUp,
  arrow,
  envelope,
  close,
  eye,
  clock,
  chevronRight,
  githubMark,
  arrowRightLine,
  folderOpen,
  refreshCcw,
  search,
  openingQuotationMark,
  closingQuotationMark,
  cake,
  wordCount,
} as const;

export const navIcons = {
  home: navHome,
  theme: navTheme,
  archive: navArchive,
  tag: navTag,
  links: navLinks,
  about: navAbout,
  notes: navNotes,
} as const;

export const socialIcons = {
  github: socialGithub,
  qq: socialQq,
  bilibili: socialBilibili,
  twitter: socialX,
  "netease-music": socialNeteaseMusic,
  gmail: socialGmail,
} as const;

export type UiIconKey = keyof typeof uiIcons;
export type NavIconKey = keyof typeof navIcons;
export type SocialIconKey = keyof typeof socialIcons;

export const svgIcons = {
  ...uiIcons,
  ...navIcons,
  ...socialIcons,
} as const;
