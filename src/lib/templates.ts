import type{IR,Method,Shape}from"@/lib/core/ir";
import{layout}from"@/lib/core/layout";
type NT=[string,string,Shape,string];
type ET=[string,string,string?];
const mk=(title:string,methodology:Method,groups:string[],nodes:NT[],edges:ET[]):IR=>({version:"1.0",meta:{title,methodology,caption:title},groups:groups.map((label,i)=>({id:"g"+(i+1),label})),nodes:nodes.map(([id,label,shape,g])=>({id,label,shape,groupId:g||undefined})),edges:edges.map(([source,target,label],i)=>({id:"e"+(i+1),source,target,label}))});

export type Template={slug:string;title:string;method:Method;summary:string;when:string;ir:IR};

const raw:(Omit<Template,"ir">&{build:()=>IR})[]=[
{slug:"quantitative-research-methodology-flowchart",title:"Quantitative research methodology flowchart",method:"quantitative",
summary:"A survey or experimental study from problem statement to reported results.",
when:"Use it for survey-based or experimental studies where you collect numeric data and test hypotheses. Replace each step label with your own instruments, sample and tests.",
build:()=>mk("Quantitative research methodology","quantitative",["Foundation","Design","Data","Analysis"],[
["n1","Start","terminator","g1"],["n2","Define problem and objectives","process","g1"],["n3","Review literature","process","g1"],["n4","Select research design","process","g2"],["n5","Define population and sample","process","g2"],["n6","Ethics approval granted?","decision","g2"],["n7","Develop instrument","document","g2"],["n8","Collect data","data","g3"],["n9","Clean and code data","process","g3"],["n10","Analyse data","process","g4"],["n11","Report findings","process","g4"],["n12","End","terminator","g4"],["n13","Revise protocol","process","g2"]],
[["n1","n2"],["n2","n3"],["n3","n4"],["n4","n5"],["n5","n6"],["n6","n7","Yes"],["n6","n13","No"],["n13","n7"],["n7","n8"],["n8","n9"],["n9","n10"],["n10","n11"],["n11","n12"]])},
{slug:"qualitative-research-methodology-flowchart",title:"Qualitative research methodology flowchart",method:"qualitative",
summary:"Interview or observation study through coding, themes and validation.",
when:"Use it for interview, focus group or observation studies analysed thematically. Adjust the coding and validation steps to match your analytic approach.",
build:()=>mk("Qualitative research methodology","qualitative",["Foundation","Fieldwork","Analysis"],[
["n1","Start","terminator","g1"],["n2","Define research questions","process","g1"],["n3","Select qualitative design","process","g1"],["n4","Recruit participants purposively","process","g2"],["n5","Obtain informed consent","document","g2"],["n6","Conduct interviews","data","g2"],["n7","Transcribe recordings","process","g3"],["n8","Code transcripts","process","g3"],["n9","Develop themes","process","g3"],["n10","Themes validated?","decision","g3"],["n11","Report themes","process","g3"],["n12","End","terminator","g3"],["n13","Re-code and refine","process","g3"]],
[["n1","n2"],["n2","n3"],["n3","n4"],["n4","n5"],["n5","n6"],["n6","n7"],["n7","n8"],["n8","n9"],["n9","n10"],["n10","n11","Yes"],["n10","n13","No"],["n13","n11"],["n11","n12"]])},
{slug:"mixed-methods-research-flowchart",title:"Mixed methods research flowchart",method:"mixed",
summary:"Explanatory sequential design: quantitative strand, then qualitative follow-up, then integration.",
when:"Use it when a quantitative phase informs a qualitative phase, and the two are integrated at interpretation. For convergent designs, run the strands in parallel instead.",
build:()=>mk("Mixed methods research (explanatory sequential)","mixed",["Phase 1: Quantitative","Phase 2: Qualitative","Integration"],[
["n1","Start","terminator","g1"],["n2","Define mixed methods questions","process","g1"],["n3","Collect survey data","data","g1"],["n4","Analyse quantitative data","process","g1"],["n5","Select follow-up participants","process","g2"],["n6","Conduct interviews","data","g2"],["n7","Analyse qualitative data","process","g2"],["n8","Integrate both strands","process","g3"],["n9","Interpret and report","process","g3"],["n10","End","terminator","g3"]],
[["n1","n2"],["n2","n3"],["n3","n4"],["n4","n5"],["n5","n6"],["n6","n7"],["n7","n8"],["n4","n8"],["n8","n9"],["n9","n10"]])},
{slug:"prisma-2020-flow-diagram-template",title:"PRISMA 2020 flow diagram template",method:"prisma",
summary:"Identification, screening and inclusion of studies for a systematic review.",
when:"Use it to report how records moved through a systematic review. Add your own counts (n = …) to each box. Confirm the layout against the current PRISMA 2020 statement and your target journal's requirements.",
build:()=>mk("PRISMA 2020 flow diagram","prisma",["Identification","Screening","Included"],[
["n1","Records identified from databases and registers (n = )","database","g1"],["n2","Duplicate records removed (n = )","process","g1"],["n3","Records screened (n = )","process","g2"],["n4","Records excluded (n = )","process","g2"],["n5","Reports sought for retrieval (n = )","process","g2"],["n6","Reports not retrieved (n = )","process","g2"],["n7","Reports assessed for eligibility (n = )","process","g2"],["n8","Reports excluded, with reasons (n = )","process","g2"],["n9","Studies included in review (n = )","process","g3"]],
[["n1","n2"],["n2","n3"],["n3","n4"],["n3","n5"],["n5","n6"],["n5","n7"],["n7","n8"],["n7","n9"]])},
{slug:"consort-flow-diagram-template",title:"CONSORT flow diagram template",method:"consort",
summary:"Participant flow through a two-arm randomised trial.",
when:"Use it to report participant flow in a parallel-group randomised trial. Add counts (n = …) to each box and the reasons for exclusion or loss. Check the current CONSORT statement for required items.",
build:()=>mk("CONSORT participant flow diagram","consort",["Enrolment","Allocation","Follow-up","Analysis"],[
["n1","Assessed for eligibility (n = )","process","g1"],["n2","Excluded, with reasons (n = )","process","g1"],["n3","Randomised (n = )","process","g1"],["n4","Allocated to intervention (n = )","process","g2"],["n5","Allocated to control (n = )","process","g2"],["n6","Lost to follow-up (n = )","process","g3"],["n7","Lost to follow-up (n = )","process","g3"],["n8","Analysed, intervention (n = )","process","g4"],["n9","Analysed, control (n = )","process","g4"]],
[["n1","n2"],["n1","n3"],["n3","n4"],["n3","n5"],["n4","n6"],["n5","n7"],["n4","n8"],["n5","n9"]])},
{slug:"design-science-research-flowchart",title:"Design science research flowchart",method:"dsr",
summary:"Six-stage design science research process from problem to communication.",
when:"Use it for studies that build and evaluate an artefact such as a model, method or system. Stages follow the widely used design science research methodology sequence.",
build:()=>mk("Design science research process","dsr",["Problem","Artefact","Evaluation"],[
["n1","Start","terminator","g1"],["n2","Identify problem and motivation","process","g1"],["n3","Define objectives of a solution","process","g1"],["n4","Design and develop artefact","process","g2"],["n5","Demonstrate artefact","process","g2"],["n6","Evaluate against objectives","process","g3"],["n7","Communicate results","process","g3"],["n8","End","terminator","g3"]],
[["n1","n2"],["n2","n3"],["n3","n4"],["n4","n5"],["n5","n6"],["n6","n7"],["n7","n8"]])},
];

export const TEMPLATES:Template[]=raw.map(({build,...t})=>({...t,ir:layout(build())}));
export const getTemplate=(slug:string)=>TEMPLATES.find(t=>t.slug===slug);
export const fallbackFor=(m:Method):IR=>(TEMPLATES.find(t=>t.method===m)??TEMPLATES[0]).ir;
