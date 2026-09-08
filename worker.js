const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8"}});
const CATS=["Bola Cheia","Bola Murcha","Gol do Jogo","Defesa do Jogo"];

function admin(request,env){
  return request.headers.get("x-admin-pin")===env.ADMIN_PIN;
}

async function currentMatch(env){
  return env.DB.prepare("SELECT * FROM matches ORDER BY id DESC LIMIT 1").first();
}

async function matchStats(env,matchId){
  const total=await env.DB.prepare("SELECT COUNT(*) total FROM match_codes WHERE match_id=?").bind(matchId).first();
  const used=await env.DB.prepare("SELECT COUNT(*) used FROM match_codes WHERE match_id=? AND used_at IS NOT NULL").bind(matchId).first();
  return {total:Number(total?.total||0),submitted:Number(used?.used||0)};
}

async function playerList(env,activeOnly=true){
  const q=activeOnly
    ? "SELECT id,name,active FROM players WHERE active=1 ORDER BY name"
    : "SELECT id,name,active FROM players ORDER BY name";
  const rows=await env.DB.prepare(q).all();
  return rows.results||[];
}

async function resultRows(env,matchId){
  const rows=await env.DB.prepare("SELECT category,player,COUNT(*) votes FROM match_votes WHERE match_id=? GROUP BY category,player ORDER BY category,votes DESC,player ASC").bind(matchId).all();
  return rows.results||[];
}

function winnerRows(rows){
  const winners=[];
  for(const cat of CATS){
    const cr=rows.filter(x=>x.category===cat);
    if(!cr.length)continue;
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
  winners.forEach(w=>statements.push(
    env.DB.prepare("INSERT OR IGNORE INTO season_awards(season,match_id,category,player) VALUES(?,?,?,?)")
      .bind(m.season,m.id,w.category,w.player)
  ));
  await env.DB.batch(statements);
  return {rows,winners};
}

export default {
  async fetch(request,env){
    const u=new URL(request.url);

    try{
      if(request.method==="GET"&&u.pathname==="/api/health"){
        const ping=await env.DB.prepare("SELECT 1 ok").first();
        return json({ok:Number(ping?.ok||0)===1,db:true});
      }

      if(request.method==="GET"&&u.pathname==="/api/players"){
        return json(await playerList(env,true));
      }

      if(request.method==="GET"&&u.pathname==="/api/status"){
        const m=await currentMatch(env);
        if(!m)return json({match:null,open:false,total:0,submitted:0});
        return json({
          match:{id:m.id,name:m.name,season:m.season,status:m.status},
          open:m.status==="open",
          ...await matchStats(env,m.id)
        });
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

        const code=await env.DB.prepare("SELECT id,used_at FROM match_codes WHERE match_id=? AND code=?")
          .bind(m.id,String(b.code).trim().toUpperCase()).first();
        if(!code||code.used_at)return json({error:"Código inválido ou já utilizado nesta partida."},400);

        const claim=await env.DB.prepare("UPDATE match_codes SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL").bind(code.id).run();
        if(Number(claim.meta?.changes||0)!==1)return json({error:"Código inválido ou já utilizado nesta partida."},400);

        try{
          await env.DB.batch(CATS.map(c=>
            env.DB.prepare("INSERT INTO match_votes(match_id,code_id,category,player) VALUES(?,?,?,?)")
              .bind(m.id,code.id,c,String(b.votes[c]).trim())
          ));
        }catch{
          await env.DB.prepare("UPDATE match_codes SET used_at=NULL WHERE id=?").bind(code.id).run();
          return json({error:"Não foi possível registrar o voto. Tente novamente."},500);
        }
        return json({ok:true});
      }

      if(request.method==="GET"&&u.pathname==="/api/admin/status"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const m=await currentMatch(env);
        const players=await playerList(env,false);
        const matches=await env.DB.prepare("SELECT id,name,season,status,created_at,closed_at FROM matches ORDER BY id DESC LIMIT 10").all();
        if(!m)return json({match:null,total:0,submitted:0,players,matches:matches.results||[]});
        return json({
          match:{id:m.id,name:m.name,season:m.season,status:m.status},
          ...await matchStats(env,m.id),
          players,
          matches:matches.results||[]
        });
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/matches"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const current=await currentMatch(env);
        if(current&&current.status==="open")return json({error:"Encerre a partida atual antes de criar uma nova."},409);

        const b=await request.json();
        const name=String(b.name||"").trim();
        if(name.length<2)return json({error:"Digite um nome para a partida."},400);
        const season=Math.max(2026,Math.min(2100,Number(b.season)||2026));
        const r=await env.DB.prepare("INSERT INTO matches(name,season,status) VALUES(?,?,'open')").bind(name,season).run();
        return json({ok:true,id:Number(r.meta?.last_row_id),name,season});
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/codes"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const m=await currentMatch(env);
        if(!m||m.status!=="open")return json({error:"A votação está encerrada. Crie ou reabra uma partida antes de gerar códigos."},423);

        const b=await request.json();
        const total=Math.max(1,Math.min(60,Number(b.total)||20));
        const codes=[];
        while(codes.length<total){
          const c="GP-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();
          if(!codes.includes(c))codes.push(c);
        }

        try{
          await env.DB.batch(codes.map(c=>env.DB.prepare("INSERT INTO match_codes(match_id,code) VALUES(?,?)").bind(m.id,c)));
        }catch{
          return json({error:"Não foi possível gerar os códigos. Tente novamente."},500);
        }
        return json({codes,match:m.name});
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/close"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const m=await currentMatch(env);
        if(!m)return json({error:"Nenhuma partida cadastrada."},404);
        const done=await finalizeMatch(env,m);
        return json({ok:true,open:false,winners:done.winners,...await matchStats(env,m.id)});
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/open"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const m=await currentMatch(env);
        if(!m)return json({error:"Nenhuma partida cadastrada."},404);
        await env.DB.batch([
          env.DB.prepare("DELETE FROM season_awards WHERE match_id=?").bind(m.id),
          env.DB.prepare("UPDATE matches SET status='open',closed_at=NULL WHERE id=?").bind(m.id)
        ]);
        return json({ok:true,open:true,...await matchStats(env,m.id)});
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/players"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const b=await request.json();
        const name=String(b.name||"").trim();
        if(name.length<2)return json({error:"Digite o nome do jogador."},400);
        await env.DB.prepare("INSERT INTO players(name,active) VALUES(?,1) ON CONFLICT(name) DO UPDATE SET active=1").bind(name).run();
        return json({ok:true,name});
      }

      if(request.method==="POST"&&u.pathname==="/api/admin/players/toggle"){
        if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
        const b=await request.json();
        const id=Number(b.id);
        const active=b.active?1:0;
        if(!id)return json({error:"Jogador inválido."},400);
        await env.DB.prepare("UPDATE players SET active=? WHERE id=?").bind(active,id).run();
        return json({ok:true});
      }

      return env.ASSETS.fetch(request);
    }catch(e){
      console.error("API error",e);
      if(u.pathname.startsWith("/api/"))return json({error:"Erro interno da API. Atualize a página e tente novamente."},500);
      return env.ASSETS.fetch(request);
    }
  }
};