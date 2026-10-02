// Join two in-bounds integer grid cells with a one-cell-wide, 8-connected line.
// Both ends receive the same tool value; revisiting never toggles a cell.
// Return the number of changed cells so empty strokes do not replace recovery.
export function paintLifeLine(cells,columns,from,to,alive=1){
 let {x,y}=from,changed=0;
 const dx=Math.abs(to.x-x),dy=-Math.abs(to.y-y);
 const sx=x<to.x?1:-1,sy=y<to.y?1:-1;
 let error=dx+dy;
 while(true){
  const index=y*columns+x;
  if(cells[index]!==alive){cells[index]=alive;changed++;}
  if(x===to.x&&y===to.y)return changed;
  const twice=2*error;
  if(twice>=dy){error+=dy;x+=sx;}
  if(twice<=dx){error+=dx;y+=sy;}
 }
}
