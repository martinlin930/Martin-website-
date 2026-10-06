const $=id=>document.getElementById(id);
let next=null,loading=false,selected=[];
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function avatar(data){
 const label=data.avatar_frame==='pig'?(data.avatar_label||'hi'):([...data.display_name][0]?.toUpperCase()||'M');
 const el=node('span','avatar',data.avatar_frame==='pig'?undefined:label);
 if(data.avatar_frame==='pig'){
  el.classList.add('avatar--pig');el.append(node('span','avatar-center',label));
  const frame=node('img','avatar-frame');frame.src='/static/avatar-frames/pig.png';frame.alt='';frame.decoding='async';el.append(frame);el.setAttribute('aria-label',label+' 的小猪头像框');
 }
 return el;
}
function timestamp(seconds){const el=node('time');const date=new Date(seconds*1000);el.dateTime=date.toISOString();el.textContent=date.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});el.title=date.toLocaleString();return el;}
async function api(path,options={}){const response=await fetch('/api/forum'+path,{...options,headers:{'X-CSRF-Token':window.forumToken,...options.headers}});let data;try{data=await response.json();}catch{throw Error(response.status===413?'照片太大了，请选择较小的图片。':'暂时无法连接，请稍后重试。');}if(!response.ok)throw Error(data.error||'操作失败，请稍后重试。');return data;}
function showError(el,message){el.textContent=message;el.classList.add('error');}
function confirmDelete(description){
 const dialog=$('deleteDialog');dialog.returnValue='cancel';$('deleteDescription').textContent=description;
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.showModal();});
}
function deleteButton(path,description,onDeleted,status){
 const button=node('button','delete-action','删除');button.type='button';
 button.onclick=async()=>{if(!await confirmDelete(description))return;button.disabled=true;try{await api(path,{method:'POST'});onDeleted();}catch(error){showError(status,error.message);}finally{button.disabled=false;}};
 return button;
}
function postCard(post){
 const card=node('article','post');const top=node('div','post-top');top.append(avatar(post));
 const identity=node('div');identity.append(node('div','post-author',post.display_name),timestamp(post.created));top.append(identity);if(window.forumAdmin)top.append(deleteButton('/posts/'+post.id+'/delete','删除后，这条动态及其照片、评论将不再公开显示。',()=>{card.remove();$('feedStatus').classList.remove('error');$('feedStatus').textContent='动态已删除。';},$('feedStatus')));card.append(top);
 if(post.body)card.append(node('p','post-body',post.body));
 if(post.images.length){const photos=node('div','post-photos'+(post.images.length===1?' single':''));post.images.forEach((src,index)=>{const button=node('button');button.type='button';button.setAttribute('aria-label','查看照片 '+(index+1));const image=node('img');image.src=src;image.alt=post.display_name+' 发布的照片';image.loading='lazy';button.append(image);button.onclick=()=>{$('fullPhoto').src=src;$('photoDialog').showModal();};photos.append(button);});card.append(photos);}
 const toggle=node('button','comments-toggle','评论 · '+post.comment_count);toggle.type='button';toggle.setAttribute('aria-expanded','false');card.append(toggle);
 const section=node('section','comments');section.hidden=true;const list=node('div'),status=node('p','status'),earlier=node('button','quiet','查看更早评论');earlier.hidden=true;section.append(list,earlier,status);let cursor=null,fetched=false;
 async function loadComments(older=false){status.textContent='加载评论…';status.classList.remove('error');earlier.disabled=true;try{const data=await api('/posts/'+post.id+'/comments'+(older?'?before='+cursor:''));const fragment=document.createDocumentFragment();data.comments.forEach(c=>{const item=node('div','comment');if(c.avatar_frame==='pig'){const identity=node('div','comment-identity');identity.append(avatar(c),node('strong','',c.display_name));item.append(identity);}else item.append(node('strong','',c.display_name));item.append(node('p','',c.body),timestamp(c.created));if(window.forumAdmin)item.append(deleteButton('/comments/'+c.id+'/delete','删除后，这条评论将不再公开显示。',()=>{item.remove();post.comment_count=Math.max(0,post.comment_count-1);toggle.textContent='评论 · '+post.comment_count;status.textContent='评论已删除。';},status));fragment.append(item);});if(older)list.prepend(fragment);else list.replaceChildren(fragment);cursor=data.next;earlier.hidden=!cursor;status.textContent=list.children.length?'':'还没有评论，来聊聊吧。';fetched=true;}catch(error){showError(status,error.message);}finally{earlier.disabled=false;}}
 earlier.onclick=()=>loadComments(true);
 if(window.forumAccount){const form=node('form','comment-form'),input=node('input'),submit=node('button','','评论');input.placeholder='写一条评论…';input.maxLength=1000;input.required=true;input.setAttribute('aria-label','评论内容');form.append(input,submit);form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{await api('/posts/'+post.id+'/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:input.value})});input.value='';post.comment_count++;toggle.textContent='评论 · '+post.comment_count;await loadComments();}catch(error){showError(status,error.message);}finally{submit.disabled=false;}};section.append(form);}else{const info=node('p','status');const link=node('a','','登录后参与评论');link.href='/login?next=/forum';info.append(link);section.append(info);}
 toggle.onclick=()=>{section.hidden=!section.hidden;toggle.setAttribute('aria-expanded',String(!section.hidden));if(!section.hidden&&!fetched)loadComments();};card.append(section);return card;
}
async function loadFeed(reset=false){if(loading)return;loading=true;$('refresh').disabled=$('morePosts').disabled=true;const status=$('feedStatus');status.classList.remove('error');status.textContent=reset?'正在加载动态…':'';try{const data=await api('/posts'+(!reset&&next?'?before='+next:''));if(reset)$('feed').replaceChildren();data.posts.forEach(post=>$('feed').append(postCard(post)));next=data.next;$('morePosts').hidden=!next;status.textContent=$('feed').children.length?'':'这里还很安静。来发布第一条动态吧。';}catch(error){showError(status,error.message);}finally{loading=false;$('refresh').disabled=$('morePosts').disabled=false;}}
$('refresh').onclick=()=>loadFeed(true);$('morePosts').onclick=()=>loadFeed();$('closePhoto').onclick=()=>$('photoDialog').close();$('photoDialog').onclick=event=>{if(event.target===$('photoDialog'))$('photoDialog').close();};
function previews(){const area=$('previews');area.replaceChildren();selected.forEach((file,index)=>{const figure=node('figure'),image=node('img'),remove=node('button','','×');const url=URL.createObjectURL(file);image.src=url;image.alt='待发布照片 '+(index+1);image.onload=image.onerror=()=>URL.revokeObjectURL(url);remove.type='button';remove.setAttribute('aria-label','移除照片 '+(index+1));remove.onclick=()=>{selected.splice(index,1);previews();};figure.append(image,remove);area.append(figure);});$('photoHint').textContent=selected.length?selected.length+' / 4 张':'最多 4 张 · 每张 4 MB';}
if($('publish')){
 $('photos').onchange=()=>{const incoming=[...$('photos').files];const status=$('publishStatus');status.classList.remove('error');status.textContent='';if(selected.length+incoming.length>4){showError(status,'一次最多选择 4 张照片。');}else if(incoming.some(f=>f.size>4*1024*1024||!['image/jpeg','image/png','image/webp'].includes(f.type))){showError(status,'请选择每张不超过 4 MB 的 JPG、PNG 或 WebP 图片。');}else{selected.push(...incoming);previews();}$('photos').value='';};
 $('publish').onsubmit=async event=>{event.preventDefault();const status=$('publishStatus');status.classList.remove('error');if(!$('body').value.trim()&&!selected.length){showError(status,'写一点内容，或选一张照片吧。');return;}$('submitPost').disabled=true;status.textContent='正在发布…';try{const data=new FormData();data.set('display_name',$('displayName').value);data.set('body',$('body').value);selected.forEach(f=>data.append('photos',f));await api('/posts',{method:'POST',body:data});$('body').value='';selected=[];previews();status.textContent='已发布，大家都可以看到。';await loadFeed(true);}catch(error){showError(status,error.message);}finally{$('submitPost').disabled=false;}};
}
loadFeed(true);

