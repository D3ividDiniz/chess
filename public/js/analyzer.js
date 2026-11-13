import {Chess} from '/vendor/chess.js';
import {search} from './engine.js';
import {winPercent,classify,accuracy,symbol} from './classifier.js';

export function pgnGame(pgn,id){
  const chess=new Chess();
  try{chess.loadPgn(pgn,{strict:false})}catch{throw new Error('Não consegui ler este PGN. Confira a notação e tente novamente.')}
  const history=chess.history({verbose:true}),replay=new Chess(),moves=[];
  for(const m of history){const before=replay.fen(),san=replay.move(m).san;moves.push({san,uci:m.from+m.to+(m.promotion||''),before,after:replay.fen(),color:m.color,capture:!!m.captured,pawn:m.piece==='p'})}
  const headers=chess.getHeaders(),isMate=chess.isCheckmate();
  return{id,pgn,headers,moves,result:headers.Result||(isMate?(chess.turn()==='w'?'0-1':'1-0'):'*'),white:headers.White||'Brancas',black:headers.Black||'Pretas',whiteRating:headers.WhiteElo||null,blackRating:headers.BlackElo||null,date:headers.Date||new Date().toISOString().slice(0,10),timeControl:headers.TimeControl||'—'}
}
function material(fen,color){const board=new Chess(fen).board(),value={p:1,n:3,b:3,r:5,q:9,k:0};return board.flat().reduce((sum,p)=>sum+(p?(p.color===color?1:-1)*value[p.type]:0),0)}
export async function analyze(game,depth,onProgress=()=>{}){
  const losses={w:[],b:[]},evals=[],bestMoves=[],tags=[];let prevCp=0;
  for(let i=0;i<game.moves.length;i++){
    const move=game.moves[i];onProgress(i+1,game.moves.length);
    const {best,info}=await search(move.after,{depth});
    const cp=info?.kind==='mate'?(info.value>0?1000:-1000):info?.value||0;
    const whiteCp=move.color==='w'?-cp:cp;
    const beforeSide=move.color==='w'?prevCp:-prevCp,afterSide=move.color==='w'?whiteCp:-whiteCp;
    const loss=winPercent(beforeSide)-winPercent(afterSide);
    const afterReply=game.moves[Math.min(i+1,game.moves.length-1)]?.after||move.after;
    const sacrifice=material(move.before,move.color)-material(afterReply,move.color)>=2;
    const category=classify(loss,move.uci===best,winPercent(beforeSide),sacrifice,move.pawn);
    tags.push({category,symbol:symbol[category],loss:+loss.toFixed(1)});losses[move.color].push(loss);evals.push(whiteCp);bestMoves.push(best);prevCp=whiteCp;
  }
  return{...game,analysis:{depth,evals,bestMoves,tags,whiteAccuracy:accuracy(losses.w),blackAccuracy:accuracy(losses.b),analyzedAt:new Date().toISOString()}}
}
