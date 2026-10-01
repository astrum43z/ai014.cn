import {lifeStep,population} from './simulations.js?v=wave-paths-1';

// Compare whole boards, including births in empty cells. Equal population alone
// is not a fixed point. The same finite, toroidal stepper powers the live board.
export function testStillLife(cells,cols,rows){
 const next=lifeStep(cells,cols,rows);
 let born=0,died=0;
 for(let i=0;i<cells.length;i++){
  if(next[i]&&!cells[i])born++;
  if(cells[i]&&!next[i])died++;
 }
 const beforeCount=population(cells),afterCount=population(next);
 return {next,beforeCount,afterCount,born,died,changed:born+died,solved:beforeCount===4&&born+died===0};
}
