import Link from"next/link";import{Header,Footer}from"@/components/Chrome";
export default function NF(){return<><Header/><main className="wrap page"><h1>Page not found</h1><p>The page may have moved, or a shared link may have expired.</p><p><Link href="/">Go to the home page</Link></p></main><Footer/></>}
