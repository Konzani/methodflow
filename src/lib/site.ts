// INPUT NEEDED: confirm name, contact email and parent site below.
export const SITE={
  name:"MethodFlow",
  url:(process.env.NEXT_PUBLIC_SITE_URL||"https://flowchart.geodesia.online").replace(/\/$/,""),
  tagline:"Methodology flowcharts, drawn to thesis standard.",
  desc:"Free methodology flowchart maker for theses and research papers. Generate from your method, start from PRISMA, CONSORT or mixed-methods templates, and export to Word, PDF, SVG and LaTeX.",
  email:"methodflow@geodesia.online",
  parent:"Geodesia",
  parentUrl:"https://geodesia.online",
};
