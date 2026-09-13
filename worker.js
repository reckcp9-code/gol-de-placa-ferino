const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
const CATS=["Bola Cheia","Bola Murcha","Gol do Jogo","Defesa do Jogo"];
const DEFAULT_PLAYER_NAMES=["Adrian","Alejandro","Allef","Bruno","Caiam","Clovis","Cristian M","David","Deco","Diego","Douglas","Edvandro","Emerson","Felipe Chagas","Ferreira","Henry","Irmão do Rodrigo","Ismael","João","Jucemar","Luigi","Marcos","Miguel","Mi","Nicolas","Ninja","Quintão","Richard","Rodrigo","Sapatenis","Vascaino","Vilson","Wagner","Welligton","Will"];
const DEFAULT_PLAYERS=DEFAULT_PLAYER_NAMES.map((name,i)=>({id:i+1,name,active:true}));
const SEED_2026={"Bola Cheia":{"Ferreira":1,"Allef":5,"João":1,"Wagner":2,"Clovis":1,"Luigi":3,"Vilson":3,"Alejandro":2,"Douglas":1,"Adrian":2,"Emerson":1,"Richard":2,"Vascaino":1,"Deco":1},"Bola Murcha":{"Vilson":2,"Welligton":1,"Ismael":2,"Bruno":3,"David":4,"Cristian M":1,"Quintão":1,"Diego":1,"Henry":1,"Caiam":1,"Ninja":2,"Deco":1,"Will":1},"Gol do Jogo":{},"Defesa do Jogo":{}};

function admin(request,env){return request.headers.get("x-admin-pin")===env.ADMIN_PIN}
function clone(v){return JSON.parse(JSON.stringify(v))}
function newMatch(name="Partida atual",season=2026){return {id:"m-"+Date.now().toString(36)+"-"+crypto.randomUUID().slice(0,6),name,season,status:"open",codes:[],createdAt:new Date().toISOString(),closedAt:null}}
async function getPlayers(env){return await env.STATE.get("players:v1","json")||clone(DEFAULT_PLAYERS)}
async function putPlayers(env,players){await env.STATE.put("players:v1",JSON.stringify(players))}
async function getStoredMatch(env){return await env.STATE.get("match:current","json")}
async function getMatch(env){return await getStoredMatch(env)||{...newMatch(),id:"virtual-initial",createdAt:null,virtual:true}}
async function putMatch(env,m){const clean={...m};delete clean.virtual;await env.STATE.put("match:current",JSON.stringify(clean))}
function votePrefix(matchId){return `vote:${matchId}:`}
async function listVoteKeys(env,matchId){let cursor,keys=[];do{const page=await env.STATE.list({prefix:votePrefix(matchId),...(cursor?{cursor}:{})});keys.push(...page.keys);cursor=page.list_complete?null:page.cursor}while(cursor);return keys}
async function countVotes(env,matchId){return (await listVoteKeys(env,matchId)).length}
async function loadVotes(env,matchId){const keys=await listVoteKeys(env,matchId);const vals=await Promise.all(keys.map(k=>env.STATE.get(k.name,"json")));return vals.filter(Boolean)}
async function deleteVotes(env,matchId){const keys=await listVoteKeys(env,matchId);await Promise.all(keys.map(k=>env.STATE.delete(k.name)));return keys.length}
function rowsFromVotes(votes){const map=new Map();for(const v of votes){for(const cat of CATS){const p=v.votes?.[cat];if(!p)continue;const key=cat+"\u0000"+p;map.set(key,(map.get(key)||0)+1)}}const rows=[];for(const [key,votes] of map){const [category,player]=key.split("\u0000");rows.push({category,player,votes})}rows.sort((a,b)=>CATS.indexOf(a.category)-CATS.indexOf(b.category)||b.votes-a.votes||a.player.localeCompare(b.player,"pt-BR"));return rows}
function winnersFromRows(rows){const out=[];for(const cat of CATS){const r=rows.filter(x=>x.category===cat);if(!r.length)continue;const top=Math.max(...r.map(x=>Number(x.votes)));out.push(...r.filter(x=>Number(x.votes)===top))}return out}
async function getDynamicRanking(env,season){return await env.STATE.get(`ranking:${season}`,"json")||{"Bola Cheia":{},"Bola Murcha":{},"Gol do Jogo":{},"Defesa do Jogo":{}}}
function rankingRows(seed,dyn){const rows=[];for(const cat of CATS){const names=new Set([...Object.keys(seed?.[cat]||{}),...Object.keys(dyn?.[cat]||{})]);for(const player of names){const titles=Number(seed?.[cat]?.[player]||0)+Number(dyn?.[cat]?.[player]||0);if(titles>0)rows.push({category:cat,player,titles})}}rows.sort((a,b)=>CATS.indexOf(a.category)-CATS.indexOf(b.category)||b.titles-a.titles||a.player.localeCompare(b.player,"pt-BR"));return rows}
function generateCodes(total){const set=new Set();while(set.size<total)set.add("GP-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase());return [...set]}
async function undoSavedWinners(env,m){const saved=await env.STATE.get(`result:${m.id}`,"json");if(!saved?.winners?.length)return;const dyn=await getDynamicRanking(env,m.season);for(const w of saved.winners){dyn[w.category]??={};const n=Math.max(0,Number(dyn[w.category][w.player]||0)-1);if(n)dyn[w.category][w.player]=n;else delete dyn[w.category][w.player]}await env.STATE.put(`ranking:${m.season}`,JSON.stringify(dyn))}

const PRESIDENT_UI=`<style>#voteCount,.stats,#adminCodes{display:none!important}</style><script>(()=>{function install(){document.querySelectorAll('#voteCount,.stats,#adminCodes').forEach(e=>e.style.display='none');const open=document.getElementById('openVote');if(!open||document.getElementById('presidentDelete'))return;const b=document.createElement('button');b.id='presidentDelete';b.className='danger';b.textContent='EXCLUIR PARTIDA';b.style.marginTop='10px';b.onclick=async()=>{if(!confirm('Excluir esta partida, seus códigos e todos os votos? Esta ação não pode ser desfeita.'))return;const pin=document.getElementById('pin')?.value||'';try{const r=await fetch('/api/admin/delete',{method:'POST',headers:{'x-admin-pin':pin}});const d=await r.json();if(!r.ok)throw Error(d.error||'Erro ao excluir');alert('Partida excluída com sucesso.');location.reload()}catch(e){alert(e.message)}};open.parentElement?.appendChild(b)}document.addEventListener('DOMContentLoaded',install);new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true})})();</script>`;
async function assetResponse(request,env){const r=await env.ASSETS.fetch(request);const ct=r.headers.get('content-type')||'';if(!ct.includes('text/html'))return r;let html=await r.text();html=html.replace('</body>',PRESIDENT_UI+'</body>');const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(html,{status:r.status,statusText:r.statusText,headers:h})}

export default {async fetch(request,env){
  const u=new URL(request.url);
  try{
    if(request.method==="GET"&&u.pathname==="/api/health")return json({ok:true,storage:"kv"});
    if(request.method==="GET"&&u.pathname==="/api/players")return json((await getPlayers(env)).filter(p=>p.active));
    if(request.method==="GET"&&u.pathname==="/api/status"){
      const m=await getMatch(env);return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},open:m.status==="open"});
    }
    if(request.method==="GET"&&u.pathname==="/api/ranking"){
      const season=Math.max(2026,Math.min(2100,Number(u.searchParams.get("season"))||2026));return json({season,rows:rankingRows(season===2026?SEED_2026:{},await getDynamicRanking(env,season))});
    }
    if(request.method==="GET"&&u.pathname==="/api/results"){
      const m=await getMatch(env);if(m.status==="open")return json({error:"Resultado secreto enquanto a votação estiver aberta.",open:true},423);const saved=await env.STATE.get(`result:${m.id}`,"json");return json({match:{id:m.id,name:m.name,season:m.season},rows:saved?.rows||rowsFromVotes(await loadVotes(env,m.id))});
    }
    if(request.method==="POST"&&u.pathname==="/api/vote"){
      const m=await getMatch(env);if(m.status!=="open")return json({error:"A votação já foi encerrada. O resultado está liberado."},423);const b=await request.json();if(!b.code||!b.votes||!CATS.every(c=>b.votes[c]))return json({error:"Preencha todas as categorias."},400);const active=new Set((await getPlayers(env)).filter(p=>p.active).map(p=>p.name));if(!CATS.every(c=>active.has(String(b.votes[c]).trim())))return json({error:"Um dos jogadores selecionados não está disponível."},400);const code=String(b.code).trim().toUpperCase();if(!(m.codes||[]).includes(code))return json({error:"Código inválido para esta partida."},400);const key=votePrefix(m.id)+code;if(await env.STATE.get(key))return json({error:"Este código já foi utilizado nesta partida."},400);const votes={};for(const c of CATS)votes[c]=String(b.votes[c]).trim();await env.STATE.put(key,JSON.stringify({code,votes,createdAt:new Date().toISOString()}));return json({ok:true});
    }
    if(request.method==="GET"&&u.pathname==="/api/admin/status"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);const m=await getMatch(env),players=await getPlayers(env);return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},players,matches:[{id:m.id,name:m.name,season:m.season,status:m.status}]});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/matches"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);const b=await request.json(),name=String(b.name||"").trim();if(name.length<2)return json({error:"Digite um nome para a partida."},400);const current=await getStoredMatch(env);if(current?.status==="open")return json({error:"Já existe uma partida aberta para votação. Encerre a partida atual antes de abrir outra."},409);const season=Math.max(2026,Math.min(2100,Number(b.season)||2026)),m=newMatch(name,season);await putMatch(env,m);return json({ok:true,id:m.id,name:m.name,season:m.season});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/codes"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);let m=await getMatch(env);if(m.status!=="open")return json({error:"A votação está encerrada. Crie ou reabra uma partida antes de gerar códigos."},423);if(await countVotes(env,m.id))return json({error:"Já existem votos nesta partida. Não é possível trocar os códigos agora."},409);const b=await request.json(),total=Math.max(1,Math.min(60,Number(b.total)||20)),codes=generateCodes(total);if(m.virtual)m={...newMatch(m.name,m.season),codes};else m={...m,codes};await putMatch(env,m);return json({codes,match:m.name});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/close"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);let m=await getMatch(env);if(m.status==="closed")return json({ok:true,open:false,alreadyClosed:true});const votes=await loadVotes(env,m.id),rows=rowsFromVotes(votes),winners=winnersFromRows(rows),dyn=await getDynamicRanking(env,m.season);for(const w of winners){dyn[w.category]??={};dyn[w.category][w.player]=Number(dyn[w.category][w.player]||0)+1}m={...m,status:"closed",closedAt:new Date().toISOString()};await env.STATE.put(`ranking:${m.season}`,JSON.stringify(dyn));await env.STATE.put(`result:${m.id}`,JSON.stringify({rows,winners}));await putMatch(env,m);return json({ok:true,open:false,winners});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/open"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);let m=await getMatch(env);if(m.status==="open")return json({ok:true,open:true,alreadyOpen:true});await undoSavedWinners(env,m);await env.STATE.delete(`result:${m.id}`);m={...m,status:"open",closedAt:null};await putMatch(env,m);return json({ok:true,open:true});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/delete"){
      if(!admin(request,env))return json({error:"Apenas o presidente pode excluir a partida."},401);const m=await getStoredMatch(env);if(!m)return json({ok:true,deleted:false});if(m.status==="closed")await undoSavedWinners(env,m);const deletedVotes=await deleteVotes(env,m.id);await env.STATE.delete(`result:${m.id}`);await env.STATE.delete("match:current");return json({ok:true,deleted:true,deletedVotes});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/players"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);const b=await request.json(),name=String(b.name||"").trim();if(name.length<2)return json({error:"Digite o nome do jogador."},400);const players=await getPlayers(env);let p=players.find(x=>x.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR"));if(p){p.name=name;p.active=true}else{p={id:Math.max(0,...players.map(x=>Number(x.id)||0))+1,name,active:true};players.push(p)}await putPlayers(env,players);return json({ok:true,player:p});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/players/toggle"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);const b=await request.json(),id=Number(b.id),players=await getPlayers(env),p=players.find(x=>Number(x.id)===id);if(!p)return json({error:"Jogador não encontrado."},404);p.active=!!b.active;await putPlayers(env,players);return json({ok:true});
    }
    return assetResponse(request,env);
  }catch(e){console.error("API error",e);if(u.pathname.startsWith("/api/"))return json({error:"Erro interno da API.",detail:String(e?.message||e||"")},500);return assetResponse(request,env)}
}};
