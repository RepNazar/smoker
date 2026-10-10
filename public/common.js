window.GameUI = (()=>{
  function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function answererId(state){
    if(!state)return null;
    if(state.phase==='answering')return state.buzzer||null;
    if(state.phase==='cat_question')return state.catReceiver||null;
    if(state.phase==='va_bank_question')return state.vaBankPlayer||null;
    if(state.phase==='triplet_question')return state.current?.triplet?.answererId||null;
    return null;
  }
  function playersHTML(players,buzzer){return `<div class="scorebar">${players.map(p=>`<div class="player ${p.id===buzzer?'active':''}"><div><b>${esc(p.name)}</b> ${p.connected?'🟢':'⚫'}</div><div class="score">${p.score}</div></div>`).join('')}</div>`}
  function boardHTML(data,state,clickable=true){const r=data.rounds[state.round];let h='<div class="grid">';r.categories.forEach(c=>h+=`<div class="cat">${esc(c.name)}</div>`);for(let qi=0;qi<5;qi++){r.categories.forEach((c,ci)=>{const q=c.questions[qi],key=`${state.round}:${ci}:${qi}`,used=state.used[key],selected=state.selectedTile?.round===state.round&&state.selectedTile.ci===ci&&state.selectedTile.qi===qi;h+=`<button class="tile ${used?'used':''} ${selected?'tile-selecting':''}" data-ci="${ci}" data-qi="${qi}" ${(!clickable||used||state.selectedTile)?'disabled':''}>${q.value}</button>`})}return h+'</div>'}
  return {esc,playersHTML,boardHTML,answererId};
})();
