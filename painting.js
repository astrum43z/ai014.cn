// Join two in-bounds integer grid cells with a one-cell-wide, 8-connected line.
// Both ends are painted alive; revisiting a cell never toggles it off.
export function paintLifeLine(cells,columns,from,to){
 let {x,y}=from;
 const dx=Math.abs(to.x-x),dy=-Math.abs(to.y-y);
 const sx=x<to.x?1:-1,sy=y<to.y?1:-1;
 let error=dx+dy;
 while(true){
  cells[y*columns+x]=1;
  if(x===to.x&&y===to.y)return;
  const twice=2*error;
  if(twice>=dy){error+=dy;x+=sx;}
  if(twice<=dx){error+=dx;y+=sy;}
 }
}
