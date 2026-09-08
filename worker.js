const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8"}});
function admin(request,env){return request.headers.get("x-admin-pin")===env.ADMIN_PIN}

async function ensureState(env){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO app_state(key,value) VALUES('voting_open','1')").run();
}
async function isVotingOpen(env){
  await ensureState(env);
  const row=await env.DB.prepare("SELECT value FROM app_state WHERE key='voting_open'").first();
  return !row || row.value==="1";
}
async function stats(env){
  const total=await env.DB.prepare("SELECT COUNT(*) total FROM voter_codes").first();
  const used=await env.DB.prepare("SELECT COUNT(*) used FROM voter_codes WHERE used_at IS NOT NULL").first();
  return {total:Number(total?.total||0),submitted:Number(used?.used||0)};
}

export default {async fetch(request,env){
  const u=new URL(request.url);

  if(u.pathname==="/api/status"){
    const open=await isVotingOpen(env);
    const s=await stats(env);
    return json({open,...s});
  }

  if(request.method==="GET"&&u.pathname==="/api/admin/status"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    const open=await isVotingOpen(env);
    const s=await stats(env);
    return json({open,...s});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/codes"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    if(!(await isVotingOpen(env)))return json({error:"A votação está encerrada. Reabra antes de gerar novos códigos."},423);
    const b=await request.json();
    const total=Math.max(1,Math.min(60,Number(b.total)||20));
    const codes=[];
    while(codes.length<total){
      const c="GP-"+crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,5).toUpperCase();
      if(!codes.includes(c))codes.push(c);
    }
    await env.DB.batch(codes.map(c=>env.DB.prepare("INSERT INTO voter_codes(code) VALUES(?)").bind(c)));
    return json({codes});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/close"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    await ensureState(env);
    await env.DB.prepare("UPDATE app_state SET value='0' WHERE key='voting_open'").run();
    return json({ok:true,open:false,...await stats(env)});
  }

  if(request.method==="POST"&&u.pathname==="/api/admin/open"){
    if(!admin(request,env))return json({error:"PIN de administrador incorreto."},401);
    await ensureState(env);
    await env.DB.prepare("UPDATE app_state SET value='1' WHERE key='voting_open'").run();
    return json({ok:true,open:true,...await stats(env)});
  }

  if(request.method==="POST"&&u.pathname==="/api/vote"){
    if(!(await isVotingOpen(env)))return json({error:"A votação já foi encerrada. O resultado está liberado."},423);
    const b=await request.json();
    const cats=["Bola Cheia","Bola Murcha","Gol do Jogo","Defesa do Jogo"];
    if(!b.code||!b.votes||!cats.every(c=>b.votes[c]))return json({error:"Preencha todas as categorias."},400);
    const code=await env.DB.prepare("SELECT id,used_at FROM voter_codes WHERE code=?").bind(String(b.code).trim().toUpperCase()).first();
    if(!code||code.used_at)return json({error:"Código inválido ou já utilizado."},400);
    await env.DB.batch(cats.map(c=>env.DB.prepare("INSERT INTO votes(code_id,category,player) VALUES(?,?,?)").bind(code.id,c,String(b.votes[c]).trim())));
    await env.DB.prepare("UPDATE voter_codes SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(code.id).run();
    return json({ok:true});
  }

  if(u.pathname==="/api/results"){
    if(await isVotingOpen(env))return json({error:"Resultado secreto enquanto a votação estiver aberta.",open:true},423);
    const rows=await env.DB.prepare("SELECT category,player,COUNT(*) votes FROM votes GROUP BY category,player ORDER BY category,votes DESC,player ASC").all();
    return json(rows.results);
  }

  return env.ASSETS.fetch(request);
}};