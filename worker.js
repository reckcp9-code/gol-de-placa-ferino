const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8"}});
const CATS=["Bola Cheia", "Bola Murcha", "Gol do Jogo", "Defesa do Jogo"];
const DEFAULT_PLAYERS=["Adrian", "Alejandro", "Allef", "Bruno", "Caiam", "Clovis", "Cristian M", "David", "Deco", "Diego", "Douglas", "Edvandro", "Emerson", "Felipe Chagas", "Ferreira", "Henry", "Irmão do Rodrigo", "Ismael", "João", "Jucemar", "Luigi", "Marcos", "Miguel", "Mi", "Nicolas", "Ninja", "Quintão", "Richard", "Rodrigo", "Sapatenis", "Vascaino", "Vilson", "Wagner", "Welligton", "Will"];
const SEED_2026=[{"season": 2026, "category": "Bola Cheia", "player": "Ferreira", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Allef", "titles": 5}, {"season": 2026, "category": "Bola Cheia", "player": "João", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Wagner", "titles": 2}, {"season": 2026, "category": "Bola Cheia", "player": "Clovis", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Luigi", "titles": 3}, {"season": 2026, "category": "Bola Cheia", "player": "Vilson", "titles": 3}, {"season": 2026, "category": "Bola Cheia", "player": "Alejandro", "titles": 2}, {"season": 2026, "category": "Bola Cheia", "player": "Douglas", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Adrian", "titles": 2}, {"season": 2026, "category": "Bola Cheia", "player": "Emerson", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Richard", "titles": 2}, {"season": 2026, "category": "Bola Cheia", "player": "Vascaino", "titles": 1}, {"season": 2026, "category": "Bola Cheia", "player": "Deco", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Vilson", "titles": 2}, {"season": 2026, "category": "Bola Murcha", "player": "Welligton", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Ismael", "titles": 2}, {"season": 2026, "category": "Bola Murcha", "player": "Bruno", "titles": 3}, {"season": 2026, "category": "Bola Murcha", "player": "David", "titles": 4}, {"season": 2026, "category": "Bola Murcha", "player": "Cristian M", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Quintão", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Diego", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Henry", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Caiam", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Ninja", "titles": 2}, {"season": 2026, "category": "Bola Murcha", "player": "Deco", "titles": 1}, {"season": 2026, "category": "Bola Murcha", "player": "Will", "titles": 1}];
function admin(request,env){return request.headers.get("x-admin-pin")===env.ADMIN_PIN}
let schemaPromise;
function ensureSchema(env){
  if(!schemaPromise)schemaPromise=setupSchema(env);
  return schemaPromise;
}
async function setupSchema(env){
  const ddl=[
    "CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1)",
    "CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, season INTEGER NOT NULL DEFAULT 2026, status TEXT NOT NULL DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP, closed_at TEXT)",
    "CREATE TABLE IF NOT EXISTS match_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, code TEXT UNIQUE NOT NULL, used_at TEXT)",
    "CREATE TABLE IF NOT EXISTS match_votes (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id INTEGER NOT NULL, code_id INTEGER NOT NULL, category TEXT NOT NULL, player TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(code_id,category))",
    "CREATE TABLE IF NOT EXISTS season_seed (season INTEGER NOT NULL, category TEXT NOT NULL, player TEXT NOT NULL, titles INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(season,category,player))",
    "CREATE TABLE IF NOT EXISTS season_awards (season INTEGER NOT NULL, match_id INTEGER NOT NULL, category TEXT NOT NULL, player TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(match_id,category,player))",
    "CREATE INDEX IF NOT EXISTS idx_match_codes_match ON match_codes(match_id)",
    "CREATE INDEX IF NOT EXISTS idx_match_votes_match ON match_votes(match_id)",
    "CREATE INDEX IF NOT EXISTS idx_match_votes_category ON match_votes(match_id,category)"
  ];
  for(const sql of ddl)await env.DB.prepare(sql).run();
  await env.DB.batch(DEFAULT_PLAYERS.map(name=>env.DB.prepare("INSERT OR IGNORE INTO players(name) VALUES(?)").bind(name)));
  await env.DB.batch(SEED_2026.map(x=>env.DB.prepare("INSERT OR IGNORE INTO season_seed(season,category,player,titles) VALUES(?,?,?,?)").bind(x.season,x.category,x.player,x.titles)));
  const count=await env.DB.prepare("SELECT COUNT(*) total FROM matches").first();
  if(Number(count?.total||0)===0){
    let oldOpen=true;
    try{
      const s=await env.DB.prepare("SELECT value FROM app_state WHERE key='voting_open'").first();
      if(s)oldOpen=s.value==="1";
    }catch{}
    const created=await env.DB.prepare("INSERT INTO matches(name,season,status,closed_at) VALUES('Partida atual',2026,?,?)").bind(oldOpen?"open":"closed",oldOpen?null:new Date().toISOString()).run();
    const matchId=Number(created.meta?.last_row_id);
    try{
      await env.DB.prepare("INSERT OR IGNORE INTO match_codes(match_id,code,used_at) SELECT ?,code,used_at FROM voter_codes").bind(matchId).run();
      await env.DB.prepare("INSERT OR IGNORE INTO match_votes(match_id,code_id,category,player,created_at) SELECT ?,mc.id,v.category,v.player,v.created_at FROM votes v JOIN voter_codes vc ON vc.id=v.code_id JOIN match_codes mc ON mc.code=vc.code WHERE mc.match_id=?").bind(matchId,matchId).run();
      if(!oldOpen)await finalizeMatch(env,{id:matchId,season:2026});
    }catch{}
  }
}
async function currentMatch(env){return env.DB.prepare("SELECT * FROM matches ORDER BY id DESC LIMIT 1").first()}
async function matchStats(env,matchId){
  const total=await env.DB.prepare("SELECT COUNT(*) total FROM match_codes WHERE match_id=?").bind(matchId).first();
  const used=await env.DB.prepare("SELECT COUNT(*) used FROM match_codes WHERE match_id=? AND used_at IS NOT NULL").bind(matchId).first();
  return {total:Number(total?.total||0),submitted:Number(used?.used||0)};
}
async function playerList(env,activeOnly=true){
  const q=activeOnly?"SELECT id,name,active FROM players WHERE active=1 ORDER BY name":"SELECT id,name,active FROM players ORDER BY name";
  const rows=await env.DB.prepare(q).all(); return rows.results||[];
}
async function resultRows(env,matchId){
  const rows=await env.DB.prepare("SELECT category,player,COUNT(*) votes FROM match_votes WHERE match_id=? GROUP BY category,player ORDER BY category,votes DESC,player ASC").bind(matchId).all();
  return rows.results||[];
}
function winnerRows(rows){
  const winners=[];
  for(const cat of CATS){
    const cr=rows.filter(x=>x.category===cat); if(!cr.length)continue;
    const top=Math.max(...cr.map(x=>Number(x.votes)));
    cr.filter(x=>Number(x.votes)===top).forEach(x=>winners.push(x));
  }
  return winners;
}
async function finalizeMatch(env,m){
  const rows=await resultRows(env,m.id);
  const winners=winnerRows(rows);
  const statements=[
    env.DB.prepare("DELETE FROM season_awards WHERE match_id=?").bind(m.id),
    env.DB.prepare("UPDATE matches SET status='closed',closed_at=CURRENT_TIMESTAMP WHERE id=?").bind(m.id)
  ];
  winners.forEach(w=>statements.push(env.DB.prepare("INSERT OR IGNORE INTO season_awards(season,match_id,category,player) VALUES(?,?,?,?)").bind(m.season,m.id,w.category,w.player)));
  await env.DB.batch(statements);
  return {rows,winners};
}

export default {async fetch(request,env){
  const u=new URL(request.url);
  await ensureSchema(env);

  if(request.method==="GET"&&u.pathname==="/api/players"){
    return json(await playerList(env,true));
  }

  if(request.method==="GET"&&u.pathname==="/api/status"){
    const m=await currentMatch(env);
    if(!m)return json({match:null,open:false,total:0,submitted:0});
    return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},open:m.status==="open",...await matchStats(env,m.id)});
  }

  if(request.method==="GET"&&u.pathname==="/api/ranking"){
    const season=Math.max(2026,Math.min(2100,Number(u.searchParams.get("season"))||2026));
    const rows=await env.DB.prepare(`SELECT category,player,SUM(titles) titles FROM (
      SELECT category,player,titles FROM season_seed WHERE season=?
      UNION ALL
      SELECT category,player,COUNT(*) titles FROM season_awards WHERE season=? GROUP BY category,player
    ) GROUP BY category,player HAVING SUM(titles)>0 ORDER BY category,titles DESC,player ASC`).bind(season,season).all();
    return json({season,rows:rows.results||[]});
  }

  if(request.method==="GET"&&u.pathname==="/api/results"){
    const m=await currentMatch(env);
    if(!m)return json({error:"Nenhuma partida cadastrada."},404);
    if(m.status==="open")return json({error:"Resultado secreto enquanto a votação estiver aberta.",open:true},423);
    return json({match:{id:m.id,name:m.name,season:m.season},rows:await resultRows(env,m.id)});
  }

  if(request.method==="POST"&&u.pathname==="/api/vote"){
    const m=await currentMatch(env);
    if(!m||m.status!=="open")return json({error:"A votação já foi encerrada. O resultado está liberado."},423);
    const b=await request.json();
    if(!b.code||!b.votes||!CATS.every(c=>b.votes[c]))return json({error:"Preencha todas as categorias."},400);
    const active=new Set((await playerList(env,true)).map(x=>x.name));
    if(!CATS.every(c=>active.has(String(b.votes[c]).trim())))return json({error:"Um dos jogadores selecionados não está disponível."},400);
    const code=await env.DB.prepare("SELECT id,used_at FROM match_codes WHERE match_id=? AND code=?").bind(m.id,String(b.code).trim().toUpperCase()).first();
    if(!code||code.used_at)return json({error:"Código inválido ou já utilizado nesta partida."},400);
    const claim=await env.DB.prepare("UPDATE match_codes SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(code.id).run();
    if(Number(claim.meta?.changes||0)!==1)return json({error:"Código inválido ou já utilizado nesta partida."},400);
    try{
      await env.DB.batch(CATS.map(c=>env.DB.prepare("INSERT INTO match_votes(match_id,code_id,category,player) VALUES(?,?,?,?)").bind(m.id,code.id,c,String(b.votes[c]).trim())));
    }catch(e){
      await env.DB.prepare("UPDATE match_codes SET used_at=NULL WHERE id=?").bind(code.id).run();
      return json({error:"Não foi possível registrar o voto. Tente novamente."},500);
    }
    return json({ok:true});
  }

  if(request.method==="GET"&&u.pathname==="/api/admin/status"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const m=await currentMatch(env); const players=await playerList(env,false);
    const matches=await env.DB.prepare("SELECT id,name,season,status,created_at,closed_at FROM matches ORDER BY id DESC LIMIT 10").all();
    if(!m)return json({match:null,total:0,submitted:0,players,matches:matches.results||[]});
    return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},...await matchStats(env,m.id),players,matches:matches.results||[]});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/matches"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const current=await currentMatch(env);
    if(current&&current.status==="open")return json({error:"Encerre a partida atual antes de criar uma nova."},409);
    const b=await request.json(); const name=String(b.name||"").trim();
    if(name.length<2)return json({error:"Digite um nome para a partida."},400);
    const season=Math.max(2026,Math.min(2100,Number(b.season)||2026));
    const r=await env.DB.prepare("INSERT INTO matches(name,season,status) VALUES(?,?,'open')").bind(name,season).run();
    return json({ok:true,id:Number(r.meta?.last_row_id),name,season});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/codes"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const m=await currentMatch(env);
    if(!m||m.status!=="open")return json({error:"A votação está encerrada. Crie ou reabra uma partida antes de gerar códigos."},423);
    const b=await request.json(); const total=Math.max(1,Math.min(60,Number(b.total)||20)); const codes=[];
    while(codes.length<total){
      const c="GP-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();
      if(!codes.includes(c))codes.push(c);
    }
    try{await env.DB.batch(codes.map(c=>env.DB.prepare("INSERT INTO match_codes(match_id,code) VALUES(?,?)").bind(m.id,c)))}catch{return json({error:"Não foi possível gerar os códigos. Tente novamente."},500)}
    return json({codes,match:m.name});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/close"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const m=await currentMatch(env); if(!m)return json({error:"Nenhuma partida cadastrada."},404);
    const done=await finalizeMatch(env,m);
    return json({ok:true,open:false,winners:done.winners,...await matchStats(env,m.id)});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/open"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const m=await currentMatch(env); if(!m)return json({error:"Nenhuma partida cadastrada."},404);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM season_awards WHERE match_id=?").bind(m.id),
      env.DB.prepare("UPDATE matches SET status='open',closed_at=NULL WHERE id=?").bind(m.id)
    ]);
    return json({ok:true,open:true,...await matchStats(env,m.id)});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/players"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const b=await request.json(); const name=String(b.name||"").trim();
    if(name.length<2)return json({error:"Digite o nome do jogador."},400);
    await env.DB.prepare("INSERT INTO players(name,active) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET active=1").bind(name).run();
    return json({ok:true,name});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/players/toggle"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const b=await request.json(); const id=Number(b.id); const active=b.active?1:0;
    if(!id)return json({error:"Jogador inválido."},400);
    await env.DB.prepare("UPDATE players SET active=? WHERE id=?").bind(active,id).run();
    return json({ok:true});
  }

  return env.ASSETS.fetch(request);
}};