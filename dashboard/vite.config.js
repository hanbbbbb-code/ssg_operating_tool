import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { createWeatherService } from './server/weather.js';

export default defineConfig(({mode})=>{
 const envDir=fileURLToPath(new URL('./',import.meta.url));
 const env=loadEnv(mode,envDir,'OPENWEATHER_API_KEY');
 const getWeather=createWeatherService({getKey:()=>process.env.OPENWEATHER_API_KEY||env.OPENWEATHER_API_KEY});
 const middleware=(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/weather')return next();
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end(JSON.stringify({error:'GET 요청만 허용됩니다.'}));}
  getWeather().then(data=>res.end(JSON.stringify(data))).catch(()=>{res.statusCode=503;res.end(JSON.stringify({error:'예제 날씨 파일을 읽을 수 없습니다.'}));});
 };
 return {plugins:[{name:'server-weather',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}}],build:{rollupOptions:{output:{manualChunks:{spreadsheet:['xlsx']}}}}};
});
