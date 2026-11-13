#!/usr/bin/env node
import { args,help } from './cli.mjs';
import { makeDraft,saveArtifacts } from './draft.mjs';
try {
  const a=args();
  if(a.help)console.log(help);
  else {const draft=await makeDraft(a.input,a.options);const out=await saveArtifacts(draft,a.out);console.log(JSON.stringify({directory:out,draft:'draft.json',editor:'editor.html',blocks:draft.blocks.length},null,2));}
} catch(e){console.error(e.message);process.exitCode=1;}
