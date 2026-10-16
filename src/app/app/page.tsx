import type{Metadata}from"next";
import Editor from"@/components/Editor";
export const metadata:Metadata={title:"Editor",robots:{index:false,follow:false}};
export default function App(){return<Editor/>}
