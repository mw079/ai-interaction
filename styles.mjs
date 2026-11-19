// The stylesheet is authored as topical files in public/styles/ and served as one /style.css.
// Order matters for the cascade: later files may refine earlier ones.
import {readFile} from 'node:fs/promises';
export const STYLE_FILES=['base.css','composer.css','page.css','components.css','controls.css'];
export async function stylesheet(){
  const parts=await Promise.all(STYLE_FILES.map(name=>readFile(new URL('./public/styles/'+name,import.meta.url),'utf8')));
  return parts.join('\n');
}
