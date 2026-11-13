const KEY='peleleca_data_v1';
const empty=()=>({version:1,games:[]});
export function read(){try{return {...empty(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return empty()}}
export function get(id){return read().games.find(g=>g.id===id)}
export function save(game){const db=read();const i=db.games.findIndex(g=>g.id===game.id);const next={...game,updatedAt:new Date().toISOString()};if(i<0)db.games.unshift(next);else db.games[i]=next;try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch{throw new Error('O armazenamento do navegador está cheio. Exporte a biblioteca e remova partidas antigas.')}}
export function remove(id){const db=read();db.games=db.games.filter(g=>g.id!==id);localStorage.setItem(KEY,JSON.stringify(db))}
export function clear(){localStorage.removeItem(KEY)}
export function exportData(){const blob=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`peleleca-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
export async function importData(file){const incoming=JSON.parse(await file.text());const games=Array.isArray(incoming)?incoming:incoming.games;if(!Array.isArray(games))throw new Error('Este arquivo não parece ser um backup Peleleca.');const db=read();const known=new Set(db.games.map(g=>g.id));for(const g of games){if(g?.id&&g?.pgn&&!known.has(g.id)){db.games.push(g);known.add(g.id)}}localStorage.setItem(KEY,JSON.stringify({...empty(),games:db.games}));return games.length}
export function usage(){return new Blob([JSON.stringify(read())]).size}
