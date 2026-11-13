export function winPercent(cp){const n=Math.max(-1200,Math.min(1200,cp));return 100/(1+Math.exp(-0.00368208*n))}
export function classify(loss,playedBest=false,previous=50,materialDrop=false,isPawn=false){if(materialDrop&&!isPawn&&loss<=2.5&&previous<92)return'Brilhante';if(playedBest&&loss< -5)return'Grande lance';if(playedBest||loss<=2)return'Melhor';if(loss<=5)return'Boa';if(loss<=10)return'Imprecisão';if(loss<=20)return'Erro';return'Blunder'}
export function accuracy(losses){if(!losses.length)return 100;const avg=losses.reduce((a,b)=>a+Math.max(0,b),0)/losses.length;return Math.max(0,Math.min(100,Math.round(100*Math.exp(-avg/23))))}
export const symbol={Brilhante:'!!','Grande lance':'!','Melhor':'✓','Boa':'',Imprecisão:'?!',Erro:'?','Blunder':'??'};
