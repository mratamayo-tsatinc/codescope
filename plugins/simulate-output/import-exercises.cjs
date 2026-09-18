// Run with `node plugins/simulate-output/import-exercises.cjs` after editing a C exercise.
const fs=require('fs');
const path=require('path');

const directory=path.join(__dirname,'exercises');
const files=fs.readdirSync(directory).filter(name=>/^Task[A-Za-z]+\.c$/.test(name)).sort();
if(!files.length)throw new Error('No C exercises found');
const exercises=files.map(name=>{
  const raw=fs.readFileSync(path.join(directory,name),'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!/^\/\*[\s\S]*?@output\s*\n[\s\S]*?@variables\s*\n[\s\S]*?\*\//.test(raw))
    throw new Error(`${name} needs @output and @variables in its leading metadata comment`);
  return {id:name.replace(/\.c$/,''),filename:name,raw};
});
const output='// Generated from exercises/*.c. Run import-exercises.cjs after editing them.\n'
  +`const SO_EXERCISES=Object.freeze(${JSON.stringify(exercises,null,2)});\n`;
fs.writeFileSync(path.join(__dirname,'catalog.js'),output);
console.log(`Imported ${exercises.length} C exercises.`);
