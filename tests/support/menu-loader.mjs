import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const grammyPath=require.resolve('grammy');
const data=s=>'data:text/javascript,'+encodeURIComponent(s);
export async function resolve(specifier,context,next){
 if(specifier.endsWith('/config.js') || specifier==='./config.js')return {url:data(`export const TELEGRAM_BOT_TOKEN='123:SYNTHETIC',TODOIST_API_TOKEN='SYNTHETIC',USER_CHAT_ID=42,GROQ_API_KEY='SYNTHETIC',PROXY_URL='',TASKS_PER_PAGE=5,MAX_TASK_PREVIEW_LENGTH=100,LABEL_FILTER_ALL='all',LABEL_FILTER_NONE='none',AI_URL='http://127.0.0.1:1',AI_API_KEY='SYNTHETIC',AI_MODEL='fixture';`),shortCircuit:true};
 if(specifier==='grammy')return {url:data(`import {createRequire} from 'node:module';const real=createRequire(${JSON.stringify(import.meta.url)})(${JSON.stringify(grammyPath)});export const InlineKeyboard=real.InlineKeyboard;export class Bot extends real.Bot{constructor(token){super(token,{botInfo:{id:123,is_bot:true,first_name:'Fixture',username:'fixture_bot'}});globalThis.__smokeBot=this;this.api.config.use(async(prev,method,payload)=>{globalThis.__calls.push({method,payload});if(['sendMessage','editMessageText'].includes(method))return {ok:true,result:{message_id:100,chat:{id:42,type:'private'},date:1,text:payload.text}};if(method==='answerCallbackQuery')return {ok:true,result:true};throw Error('Unexpected Telegram call '+method)});}start(){return Promise.resolve();}}`),shortCircuit:true};
 if(specifier==='@doist/todoist-api-typescript')return {url:data(`export class TodoistApi{async getProjects(){return [{id:'p1',name:'Fixture project'}]} async getTasks(){return []} async getLabels(){return []}}`),shortCircuit:true};
 if(specifier==='groq-sdk')return {url:data('export default class Groq {}'),shortCircuit:true};
 if(specifier==='axios')return {url:data('export default {post:async()=>{throw Error("Network disabled")}}'),shortCircuit:true};
 if(specifier==='node-cron')return {url:data('export default {schedule:()=>({stop(){}})}'),shortCircuit:true};
 return next(specifier,context);
}
