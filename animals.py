"""Account-owned farm animals. Progress is awarded only by authenticated server actions."""
import json,math,time
from pathlib import Path
from flask import request,session

def install_animals(app,database,world_player_id,pet_progress):
    spots=json.loads(Path(__file__).with_name('static').joinpath('animal-spots.json').read_text())
    @app.post('/api/world/animal')
    def animal_action():
        data=request.get_json(silent=True) or {}
        if not isinstance(data,dict):return {'error':'操作格式不正确。'},400
        player_id=world_player_id(data);uid=session.get('user_id')
        if not uid:return {'error':'登录账户后才能领养并保存动物。'},401
        kind=data.get('kind');spot=next((s for s in spots if s['kind']==kind),None)
        if not spot:return {'error':'请选择有效的动物。'},400
        action=data.get('action');now=time.time()
        with database() as db:
            player=db.execute('SELECT * FROM players WHERE id=?',(player_id,)).fetchone()
            if not player or player['user_id']!=uid:return {'error':'请先进入村庄。'},401
            saved=db.execute('SELECT * FROM game_saves WHERE user_id=?',(uid,)).fetchone()
            if not saved:return {'error':'账户存档尚未准备好。'},409
            pets=json.loads(saved['animal_pets']);pet=pets.get(kind)
            cost=0
            if action=='adopt':
                name=data.get('name','')
                if not isinstance(name,str) or not 1<=len(name.strip())<=24:return {'error':'名字请输入 1–24 个字符。'},400
                if not pet and math.hypot(player['x']-spot['x'],player['z']-spot['z'])>spot['radius']+3:return {'error':'请走近这只动物再领养。'},400
                pet=pet or {'xp':0,'interaction_at':0};pet['name']=name.strip();pets[kind]=pet;pets['active']=kind;message='动物已领养，正在跟随你。'
            elif action in ('feed','pet','call'):
                if not pet:return {'error':'先领养这只动物吧。'},400
                if pets.get('active')!=kind:return {'error':'先选择这只动物跟随你。'},400
                if now-pet.get('interaction_at',0)<5:return {'error':'5 秒后再互动吧。'},429
                cost=1 if action=='feed' else 0
                if saved['dog_food']<cost:return {'error':'食物不足，去草丛采集吧。'},400
                reward=25 if action=='feed' else 5 if action=='pet' else 0
                pet['xp']=min(10000,pet['xp']+reward);pet['interaction_at']=now
                message={'feed':'喂食成功 · +25 经验','pet':'动物很开心 · +5 经验','call':'动物正在靠近你'}[action]
            else:return {'error':'未知操作。'},400
            encoded=json.dumps(pets,ensure_ascii=False)
            changed=db.execute('UPDATE game_saves SET animal_pets=?,dog_food=dog_food-? WHERE user_id=? AND animal_pets=? AND dog_food>=? RETURNING user_id',(encoded,cost,uid,saved['animal_pets'],cost)).fetchone()
            if not changed:return {'error':'存档刚刚已更新，请再试一次。'},409
            updated=db.execute('SELECT * FROM game_saves WHERE user_id=?',(uid,)).fetchone()
        return {'animals':pets,'pet':pet_progress(updated),'message':message}
