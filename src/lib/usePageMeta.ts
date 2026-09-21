import { useEffect } from "react";

const SITE_URL = "https://aiagentvoice-ten.vercel.app";

interface PageMeta {
  title: string;
  description: string;
  /** Path beginning with "/", e.g. "/contact". Defaults to current pathname. */
  path?: string;
  ogTitle?: string;
  ogDescription?: string;
}

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, name] = selector.match(/\[(?:name|property)="([^"]+)"\]/) ?? [];
    if (selector.includes("property=")) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function usePageMeta({ title, description, path, ogTitle, ogDescription }: PageMeta) {
  useEffect(() => {
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", ogTitle ?? title);
    setMeta('meta[property="og:description"]', "content", ogDescription ?? description);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", ogTitle ?? title);
    setMeta('meta[name="twitter:description"]', "content", ogDescription ?? description);
    setLink("canonical", url);
  }, [title, description, path, ogTitle, ogDescription]);
}
