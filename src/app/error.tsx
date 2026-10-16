"use client";
export default function Err({reset}:{error:Error;reset:()=>void}){return<main className="wrap page"><h1>Something went wrong</h1><p>Your saved draft is still in this browser. Reload the page to continue.</p><button className="pri" onClick={reset}>Reload</button></main>}
