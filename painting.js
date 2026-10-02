// Join two in-bounds integer grid cells with a one-cell-wide, 8-connected line.
// Both ends receive the same tool value; revisiting never toggles a cell.
export function paintLifeLine(cells,columns,from,to,alive=1){
 let {x,y}=from;
 const dx=Math.abs(to.x-x),dy=-Math.abs(to.y-y);
 const sx=x<to.x?1:-1,sy=y<to.y?1:-1;
 let error=dx+dy;
 while(true){
  cells[y*columns+x]=alive;
  if(x===to.x&&y===to.y)return;
  const twice=2*error;
  if(twice>=dy){error+=dy;x+=sx;}
  if(twice<=dx){error+=dx;y+=sy;}
 }
}
