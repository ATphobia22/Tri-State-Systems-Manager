export interface GridNode { readonly x: number; readonly y: number; readonly walkable: boolean; }
export type GridCost = (from: GridNode, to: GridNode) => number;
export type GridHeuristic = (a: GridNode, b: GridNode) => number;
export interface GridPathResult { readonly path: readonly GridNode[]; readonly cost: number; readonly expanded: number; }

const OCTILE: GridHeuristic = (a, b) => {
  const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};
const DEFAULT_COST: GridCost = (a, b) => a.x !== b.x && a.y !== b.y ? Math.SQRT2 : 1;
const DIRS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;

export class GridMap {
  constructor(readonly width: number, readonly height: number, private readonly walkable: boolean[]) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new RangeError('invalid grid dimensions');
    if (walkable.length !== width * height) throw new RangeError('walkable array length mismatch');
  }
  node(x: number, y: number): GridNode | null { return this.inBounds(x,y) ? { x, y, walkable: this.walkable[y * this.width + x] } : null; }
  inBounds(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  neighbors(node: GridNode): GridNode[] {
    const out: GridNode[] = [];
    for (const [dx,dy] of DIRS) { const n = this.node(node.x+dx,node.y+dy); if (!n?.walkable) continue; if (dx !== 0 && dy !== 0 && (!this.node(node.x+dx,node.y)?.walkable || !this.node(node.x,node.y+dy)?.walkable)) continue; out.push(n); }
    return out;
  }
  lineOfSight(a: GridNode, b: GridNode): boolean {
    let x0=a.x, y0=a.y, x1=b.x, y1=b.y, dx=Math.abs(x1-x0), dy=Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx-dy;
    while (true) { if (!this.node(x0,y0)?.walkable) return false; if (x0===x1 && y0===y1) return true; const e2=2*err; if (e2>-dy){err-=dy;x0+=sx;} if(e2<dx){err+=dx;y0+=sy;} }
  }
}

function key(n: GridNode): string { return `${n.x},${n.y}`; }
function reconstruct(came: Map<string, string>, nodes: Map<string, GridNode>, end: GridNode): GridNode[] {
  const path=[end]; let k=key(end); while(came.has(k)){ k=came.get(k)!; path.push(nodes.get(k)!); } return path.reverse();
}

export function aStar(grid: GridMap, start: GridNode, goal: GridNode, heuristic: GridHeuristic = OCTILE, cost: GridCost = DEFAULT_COST): GridPathResult {
  const open = new Map<string, number>(); const g=new Map<string,number>([[key(start),0]]); const f=new Map<string,number>([[key(start),heuristic(start,goal)]]); const came=new Map<string,string>(); const nodes=new Map<string,GridNode>([[key(start),start],[key(goal),goal]]); let expanded=0;
  open.set(key(start), f.get(key(start))!);
  while(open.size){ let currentKey=''; let best=Infinity; for(const [k,v] of open) if(v<best){best=v;currentKey=k;} const current=nodes.get(currentKey)!; open.delete(currentKey); expanded++; if(currentKey===key(goal)){const path=reconstruct(came,nodes,goal);return {path,cost:g.get(currentKey)!,expanded};}
    for(const n of grid.neighbors(current)){ const nk=key(n); nodes.set(nk,n); const tentative=g.get(currentKey)!+cost(current,n); if(tentative < (g.get(nk)??Infinity)){came.set(nk,currentKey);g.set(nk,tentative);f.set(nk,tentative+heuristic(n,goal));open.set(nk,f.get(nk)!);} }
  }
  return {path:[],cost:Infinity,expanded};
}

function jump(grid: GridMap, current: GridNode, dx:number, dy:number, goal:GridNode): GridNode | null {
  const nx=current.x+dx, ny=current.y+dy; const next=grid.node(nx,ny); if(!next?.walkable) return null;
  if(nx===goal.x && ny===goal.y) return next;
  if(dx!==0 && dy!==0 && (!grid.node(current.x+dx,current.y)?.walkable || !grid.node(current.x,current.y+dy)?.walkable)) return null;
  if(dx!==0 && dy!==0){ if((grid.node(nx-dx,ny+dy)?.walkable===false && grid.node(nx-dx,ny)?.walkable) || (grid.node(nx+dx,ny-dy)?.walkable===false && grid.node(nx,ny-dy)?.walkable)) return next; if(jump(grid,next,dx,0,goal)||jump(grid,next,0,dy,goal)) return next; }
  else if(dx!==0){ if((grid.node(nx,ny+1)?.walkable===false && grid.node(nx-dx,ny+1)?.walkable) || (grid.node(nx,ny-1)?.walkable===false && grid.node(nx-dx,ny-1)?.walkable)) return next; }
  else { if((grid.node(nx+1,ny)?.walkable===false && grid.node(nx+1,ny-dy)?.walkable) || (grid.node(nx-1,ny)?.walkable===false && grid.node(nx-1,ny-dy)?.walkable)) return next; }
  return jump(grid,next,dx,dy,goal);
}

export function jumpPointSearch(grid: GridMap, start: GridNode, goal: GridNode): GridPathResult {
  const open = new Map<string,number>(); const g=new Map<string,number>([[key(start),0]]); const came=new Map<string,string>(); const nodes=new Map<string,GridNode>([[key(start),start],[key(goal),goal]]); let expanded=0; open.set(key(start),OCTILE(start,goal));
  while(open.size){let ck='';let best=Infinity;for(const [k,v] of open)if(v<best){best=v;ck=k;}open.delete(ck);const current=nodes.get(ck)!;expanded++;if(ck===key(goal)){const jumps=reconstruct(came,nodes,goal);const path:GridNode[]=[];for(let i=0;i<jumps.length-1;i++){const a=jumps[i],b=jumps[i+1],sx=Math.sign(b.x-a.x),sy=Math.sign(b.y-a.y);let x=a.x,y=a.y;while(x!==b.x||y!==b.y){x+=sx;y+=sy;path.push(grid.node(x,y)!);}}path.unshift(start);return {path,cost:g.get(ck)!,expanded};}
    for(const [dx,dy] of DIRS){const n=jump(grid,current,dx,dy,goal);if(!n)continue;const nk=key(n),ng=g.get(ck)!+Math.hypot(n.x-current.x,n.y-current.y);if(ng<(g.get(nk)??Infinity)){came.set(nk,ck);g.set(nk,ng);nodes.set(nk,n);open.set(nk,ng+OCTILE(n,goal));}}
  } return {path:[],cost:Infinity,expanded};
}

export function thetaStar(grid: GridMap, start: GridNode, goal: GridNode): GridPathResult {
  const open=new Map<string,number>();const g=new Map<string,number>([[key(start),0]]);const parent=new Map<string,string>([[key(start),key(start)]]);const nodes=new Map<string,GridNode>([[key(start),start],[key(goal),goal]]);let expanded=0;open.set(key(start),OCTILE(start,goal));
  while(open.size){let ck='';let best=Infinity;for(const [k,v] of open)if(v<best){best=v;ck=k;}open.delete(ck);const current=nodes.get(ck)!;expanded++;if(ck===key(goal)){const pkeys=[];let k=ck;while(true){pkeys.push(k);const p=parent.get(k)!;if(p===k)break;k=p;}pkeys.reverse();return {path:pkeys.map(k=>nodes.get(k)!),cost:g.get(ck)!,expanded};}
    for(const n of grid.neighbors(current)){const nk=key(n);nodes.set(nk,n);const pk=parent.get(ck)!;const pnode=nodes.get(pk)!;let tentative:number;let newParent:string;if(grid.lineOfSight(pnode,n)){tentative=g.get(pk)!+Math.hypot(n.x-pnode.x,n.y-pnode.y);newParent=pk;}else{tentative=g.get(ck)!+DEFAULT_COST(current,n);newParent=ck;}if(tentative<(g.get(nk)??Infinity)){g.set(nk,tentative);parent.set(nk,newParent);open.set(nk,tentative+OCTILE(n,goal));}}
  } return {path:[],cost:Infinity,expanded};
}

export class DStarLiteGrid {
  private readonly g=new Map<string,number>(); private readonly rhs=new Map<string,number>(); private readonly open=new Map<string,[number,number]>(); private km=0; private lastStart:GridNode;
  constructor(private readonly grid:GridMap, private readonly start:GridNode, private readonly goal:GridNode){this.lastStart=start;this.rhs.set(key(goal),0);this.insert(goal);}
  private h(a:GridNode,b:GridNode):number{return OCTILE(a,b);}
  private calculateKey(n:GridNode):[number,number]{const k=Math.min(this.g.get(key(n))??Infinity,this.rhs.get(key(n))??Infinity);return [k+this.h(this.lastStart,n)+this.km,k];}
  private insert(n:GridNode):void{this.open.set(key(n),this.calculateKey(n));}
  private updateVertex(u:GridNode):void{const uk=key(u);if(uk!==key(this.goal)){let best=Infinity;for(const s of this.grid.neighbors(u))best=Math.min(best,(this.g.get(key(s))??Infinity)+DEFAULT_COST(u,s));this.rhs.set(uk,best);}this.open.delete(uk);if((this.g.get(uk)??Infinity)!==(this.rhs.get(uk)??Infinity))this.insert(u);}
  updateObstacle(x:number,y:number,walkable:boolean):void{const node=this.grid.node(x,y);if(!node)return;this.gridSetWalkable(x,y,walkable);this.updateVertex(node);for(const n of this.grid.neighbors(node))this.updateVertex(n);}
  private gridSetWalkable(x:number,y:number,walkable:boolean):void{(this.grid as unknown as {walkable:boolean[]}).walkable[y*this.grid.width+x]=walkable;}
  computePath():GridPathResult{let expanded=0;while(true){let topKey:[number,number]=[Infinity,Infinity],topNode:GridNode|null=null;for(const [k,v] of this.open){if(v[0]<topKey[0]||(v[0]===topKey[0]&&v[1]<topKey[1])){topKey=v;const [x,y]=k.split(',').map(Number);topNode=this.grid.node(x,y)!;}}const startKey=this.calculateKey(this.lastStart);const startConsistent=(this.rhs.get(key(this.lastStart))??Infinity)===(this.g.get(key(this.lastStart))??Infinity);const topNotBetter=topKey[0]>startKey[0]||(topKey[0]===startKey[0]&&topKey[1]>=startKey[1]);if(!topNode||(topNotBetter&&startConsistent))break;this.open.delete(key(topNode));expanded++;const uk=key(topNode);const gOld=this.g.get(uk)??Infinity;const rhs=this.rhs.get(uk)??Infinity;if(gOld>rhs){this.g.set(uk,rhs);for(const p of this.grid.neighbors(topNode))this.updateVertex(p);}else{this.g.set(uk,Infinity);this.updateVertex(topNode);for(const p of this.grid.neighbors(topNode))this.updateVertex(p);}}
    const path=[this.start];let current=this.start;let guard=0;let cost=0;while(key(current)!==key(this.goal)&&guard++<this.grid.width*this.grid.height){let best:GridNode|null=null;let bestValue=Infinity;for(const n of this.grid.neighbors(current)){const value=(this.g.get(key(n))??Infinity)+DEFAULT_COST(current,n);if(value<bestValue){bestValue=value;best=n;}}if(!best||!Number.isFinite(bestValue))return {path:[],cost:Infinity,expanded};path.push(best);cost+=DEFAULT_COST(current,best);current=best;}return {path:key(current)===key(this.goal)?path:[],cost:key(current)===key(this.goal)?cost:Infinity,expanded};}
}
