import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('static/world.js','utf8'),elements={joystick:{getBoundingClientRect:()=>({left:0,top:0,width:124,height:124}),setPointerCapture(){}},joystickKnob:{style:{}},message:{addEventListener(){}}};
const context=vm.createContext({Math,console,canvas:{setPointerCapture(){}},document:{pointerLockElement:null,activeElement:{blur(){}},addEventListener(){}},window:{addEventListener(){}},$:id=>elements[id],yaw:0,pitch:0});
vm.runInContext(source.split('\n').find(line=>line.startsWith('let finger=null;')),context);
const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
context.canvas.onpointerdown(event(1,10,10));context.canvas.onpointermove(event(2,100,100));assert.equal(context.yaw,0);context.canvas.onpointermove(event(1,20,10));assert.equal(context.yaw,.05);context.canvas.onlostpointercapture(event(1,20,10));context.canvas.onpointerdown(event(3,10,10));context.canvas.onpointermove(event(3,20,10));assert.equal(context.yaw,.1);
const start=source.indexOf("const joystick=$('joystick')"),end=source.indexOf('window.onkeydown=',start);vm.runInContext(source.slice(start,end),context);
for(let id=4;id<7;id++){elements.joystick.onpointerdown(event(id,62,62));elements.joystick.onpointerup(event(id,62,62));}
elements.joystick.onpointerdown(event(7,62,62));elements.joystick.onpointermove(event(7,62,10));assert(vm.runInContext('stickY',context)<-.9);elements.joystick.onlostpointercapture(event(7,62,10));assert.equal(vm.runInContext('stickY',context),0);elements.joystick.onpointerdown(event(8,62,10));assert(vm.runInContext('stickY',context)<-.9);console.log('Repeated taps, multiple pointers, lost pointer capture and resumed joystick movement passed.');
