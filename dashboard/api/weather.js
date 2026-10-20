import { getWeather } from '../server/weather.js';

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET 요청만 허용됩니다.'});}
 try {return res.status(200).json(await getWeather());}
 catch {return res.status(503).json({error:'예제 날씨 파일을 읽을 수 없습니다.'});}
}
