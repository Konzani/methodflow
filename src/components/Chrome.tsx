import Link from "next/link";
import { SITE } from "@/lib/site";

export function Header() {
  return (
    <header className="site-h">
      <div className="wrap">
        <Link href="/" className="logo">
          {SITE.name}
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/templates">Templates</Link>
          <Link href="/app">Open editor</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-f">
      <div className="wrap">
        <span>
          {SITE.name} by <a href={SITE.parentUrl}>{SITE.parent}</a>
        </span>
        <span>
          <Link href="/templates">Templates</Link> ·{" "}
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/contact">Contact</Link>
        </span>
      </div>
    </footer>
  );
}