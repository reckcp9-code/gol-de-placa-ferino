const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8","cache-control":"no-store"}});
const CATS=["Bola Cheia","Bola Murcha","Gol do Jogo","Defesa do Jogo"];

function admin(request,env){return request.headers.get("x-admin-pin")===env.ADMIN_PIN}
function primary(env){return env.DB.withSession("first-primary")}
async function currentMatch(db){return db.prepare("SELECT * FROM matches ORDER BY id DESC LIMIT 1").first()}
async function matchStats(db,matchId){
  const total=await db.prepare("SELECT COUNT(*) total FROM match_codes WHERE match_id=?").bind(matchId).first();
  const used=await db.prepare("SELECT COUNT(*) used FROM match_codes WHERE match_id=? AND used_at IS NOT NULL").bind(matchId).first();
  return {total:Number(total?.total||0),submitted:Number(used?.used||0)};
}
async function playerList(db,activeOnly=true){
  const q=activeOnly?"SELECT id,name,active FROM players WHERE active=1 ORDER BY name":"SELECT id,name,active FROM players ORDER BY name";
  const rows=await db.prepare(q).all();return rows.results||[];
}
async function resultRows(db,matchId){
  const rows=await db.prepare("SELECT category,player,COUNT(*) votes FROM match_votes WHERE match_id=? GROUP BY category,player ORDER BY category,votes DESC,player ASC").bind(matchId).all();
  return rows.results||[];
}
function winnerRows(rows){
  const winners=[];
  for(const cat of CATS){
    const cr=rows.filter(x=>x.category===cat);if(!cr.length)continue;
    const top=Math.max(...cr.map(x=>Number(x.votes)));
    cr.filter(x=>Number(x.votes)===top).forEach(x=>winners.push(x));
  }
  return winners;
}
async function finalizeMatch(db,m){
  const rows=await resultRows(db,m.id),winners=winnerRows(rows);
  await db.prepare("DELETE FROM season_awards WHERE match_id=?").bind(m.id).run();
  await db.prepare("UPDATE matches SET status='closed',closed_at=CURRENT_TIMESTAMP WHERE id=?").bind(m.id).run();
  for(const w of winners){
    await db.prepare("INSERT OR IGNORE INTO season_awards(season,match_id,category,player) VALUES(?,?,?,?)").bind(m.season,m.id,w.category,w.player).run();
  }
  return {rows,winners};
}

export default {async fetch(request,env){
  const u=new URL(request.url);
  const db=primary(env);
  try{
    if(request.method==="GET"&&u.pathname==="/api/health"){
      const ping=await db.prepare("SELECT 1 ok").first();return json({ok:Number(ping?.ok||0)===1,db:true});
    }
    if(request.method==="GET"&&u.pathname==="/api/players")return json(await playerList(db,true));
    if(request.method==="GET"&&u.pathname==="/api/status"){
      const m=await currentMatch(db);if(!m)return json({match:null,open:false,total:0,submitted:0});
      return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},open:m.status==="open",...await matchStats(db,m.id)});
    }
    if(request.method==="GET"&&u.pathname==="/api/ranking"){
      const season=Math.max(2026,Math.min(2100,Number(u.searchParams.get("season"))||2026));
      const rows=await db.prepare(`SELECT category,player,SUM(titles) titles FROM (
        SELECT category,player,titles FROM season_seed WHERE season=?
        UNION ALL
        SELECT category,player,COUNT(*) titles FROM season_awards WHERE season=? GROUP BY category,player
      ) GROUP BY category,player HAVING SUM(titles)>0 ORDER BY category,titles DESC,player ASC`).bind(season,season).all();
      return json({season,rows:rows.results||[]});
    }
    if(request.method==="GET"&&u.pathname==="/api/results"){
      const m=await currentMatch(db);if(!m)return json({error:"Nenhuma partida cadastrada."},404);
      if(m.status==="open")return json({error:"Resultado secreto enquanto a votação estiver aberta.",open:true},423);
      return json({match:{id:m.id,name:m.name,season:m.season},rows:await resultRows(db,m.id)});
    }
    if(request.method==="POST"&&u.pathname==="/api/vote"){
      const m=await currentMatch(db);if(!m||m.status!=="open")return json({error:"A votação já foi encerrada. O resultado está liberado."},423);
      const b=await request.json();if(!b.code||!b.votes||!CATS.every(c=>b.votes[c]))return json({error:"Preencha todas as categorias."},400);
      const active=new Set((await playerList(db,true)).map(x=>x.name));
      if(!CATS.every(c=>active.has(String(b.votes[c]).trim())))return json({error:"Um dos jogadores selecionados não está disponível."},400);
      const code=await db.prepare("SELECT id,used_at FROM match_codes WHERE match_id=? AND code=?").bind(m.id,String(b.code).trim().toUpperCase()).first();
      if(!code||code.used_at)return json({error:"Código inválido ou já utilizado nesta partida."},400);
      const claim=await db.prepare("UPDATE match_codes SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(code.id).run();
      if(Number(claim.meta?.changes||0)!==1)return json({error:"Código inválido ou já utilizado nesta partida."},400);
      try{
        for(const c of CATS){await db.prepare("INSERT INTO match_votes(match_id,code_id,category,player) VALUES(?,?,?,?)").bind(m.id,code.id,c,String(b.votes[c]).trim()).run()}
      }catch(e){
        await db.prepare("DELETE FROM match_votes WHERE match_id=? AND code_id=?").bind(m.id,code.id).run();
        await db.prepare("UPDATE match_codes SET used_at=NULL WHERE id=?").bind(code.id).run();
        throw e;
      }
      return json({ok:true});
    }
    if(request.method==="GET"&&u.pathname==="/api/admin/status"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const m=await currentMatch(db),players=await playerList(db,false);
      const matches=await db.prepare("SELECT id,name,season,status,created_at,closed_at FROM matches ORDER BY id DESC LIMIT 10").all();
      if(!m)return json({match:null,total:0,submitted:0,players,matches:matches.results||[]});
      return json({match:{id:m.id,name:m.name,season:m.season,status:m.status},...await matchStats(db,m.id),players,matches:matches.results||[]});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/diagnostic"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const tag="__diag_"+crypto.randomUUID();
      await db.prepare("INSERT INTO players(name,active) VALUES(?,0)").bind(tag).run();
      await db.prepare("DELETE FROM players WHERE name=?").bind(tag).run();
      const ping=await db.prepare("SELECT 1 ok").first();
      return json({ok:Number(ping?.ok||0)===1,admin:true,dbWrite:true});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/matches"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const b=await request.json(),name=String(b.name||"").trim();
      if(name.length<2)return json({error:"Digite um nome para a partida."},400);
      const season=Math.max(2026,Math.min(2100,Number(b.season)||2026));
      const current=await currentMatch(db);
      if(current&&current.status==="open"){
        const s=await matchStats(db,current.id);
        if(s.total===0&&s.submitted===0){
          const r=await db.prepare("UPDATE matches SET name=?,season=?,status='open',closed_at=NULL WHERE id=?").bind(name,season,current.id).run();
          if(!r.success)throw new Error("Falha ao atualizar a partida vazia.");
          return json({ok:true,id:current.id,name,season,reusedEmpty:true});
        }
        return json({error:"A partida atual já tem códigos ou votos. Encerre ela antes de criar uma nova."},409);
      }
      const r=await db.prepare("INSERT INTO matches(name,season,status) VALUES(?,?,'open')").bind(name,season).run();
      if(!r.success)throw new Error("Falha ao criar nova partida.");
      return json({ok:true,id:Number(r.meta?.last_row_id||0),name,season,reusedEmpty:false});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/codes"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const m=await currentMatch(db);if(!m||m.status!=="open")return json({error:"A votação está encerrada. Crie ou reabra uma partida antes de gerar códigos."},423);
      const b=await request.json(),total=Math.max(1,Math.min(60,Number(b.total)||20)),codes=[];
      while(codes.length<total){const c="GP-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();if(!codes.includes(c))codes.push(c)}
      for(const c of codes){await db.prepare("INSERT INTO match_codes(match_id,code) VALUES(?,?)").bind(m.id,c).run()}
      return json({codes,match:m.name});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/close"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const m=await currentMatch(db);if(!m)return json({error:"Nenhuma partida cadastrada."},404);
      if(m.status==="closed")return json({ok:true,open:false,alreadyClosed:true,...await matchStats(db,m.id)});
      const done=await finalizeMatch(db,m);return json({ok:true,open:false,winners:done.winners,...await matchStats(db,m.id)});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/open"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const m=await currentMatch(db);if(!m)return json({error:"Nenhuma partida cadastrada."},404);
      if(m.status==="open")return json({ok:true,open:true,alreadyOpen:true,...await matchStats(db,m.id)});
      await db.prepare("DELETE FROM season_awards WHERE match_id=?").bind(m.id).run();
      await db.prepare("UPDATE matches SET status='open',closed_at=NULL WHERE id=?").bind(m.id).run();
      return json({ok:true,open:true,...await matchStats(db,m.id)});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/players"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const b=await request.json(),name=String(b.name||"").trim();if(name.length<2)return json({error:"Digite o nome do jogador."},400);
      await db.prepare("INSERT OR IGNORE INTO players(name,active) VALUES(?,1)").bind(name).run();
      await db.prepare("UPDATE players SET active=1 WHERE name=?").bind(name).run();
      const p=await db.prepare("SELECT id,name,active FROM players WHERE name=?").bind(name).first();
      if(!p)throw new Error("Jogador não foi localizado após o cadastro.");
      return json({ok:true,player:p});
    }
    if(request.method==="POST"&&u.pathname==="/api/admin/players/toggle"){
      if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
      const b=await request.json(),id=Number(b.id),active=b.active?1:0;if(!id)return json({error:"Jogador inválido."},400);
      const r=await db.prepare("UPDATE players SET active=? WHERE id=?").bind(active,id).run();
      if(Number(r.meta?.changes||0)!==1)return json({error:"Jogador não encontrado."},404);
      return json({ok:true});
    }
    return env.ASSETS.fetch(request);
  }catch(e){
    console.error("API error",e);
    if(u.pathname.startsWith("/api/"))return json({error:"Erro interno da API.",detail:String(e?.message||e||"")},500);
    return env.ASSETS.fetch(request);
  }
}};
