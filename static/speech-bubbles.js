// Recent speech is bound to a server-issued player ID, never a nickname.
export function recentSpeech(messages, serverTimeMs, lifetime=6000){
 const result=new Map();
 for(const message of messages){
  const created=Number(message.created)*1000;
  if(typeof message.player_id!=='string'||!message.player_id||typeof message.body!=='string'||!Number.isFinite(created))continue;
  const expires=created+lifetime;
  if(expires<=serverTimeMs||created>serverTimeMs+1000)continue;
  const previous=result.get(message.player_id);
  if(!previous||message.id>previous.id)result.set(message.player_id,{id:message.id,text:message.body,expires});
 }
 return result;
}
