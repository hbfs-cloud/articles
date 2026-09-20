const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
const tickers=['KLAC','AAOI','AMD','AG','ALLR'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const ticker of tickers){
  const rev=path.join(root,'analyses',ticker,'_runs','20260919-update','revision');
  const analysisBytes=fs.readFileSync(path.join(rev,`${ticker}.json`));
  const analysisPath=path.join(root,'data','analyses-data',`${ticker}.json`);
  fs.writeFileSync(analysisPath,analysisBytes);
  const evidence=JSON.parse(fs.readFileSync(path.join(rev,'evidence.json'),'utf8'));
  evidence.analysis_path=`data/analyses-data/${ticker}.json`;
  evidence.analysis_sha256=sha(analysisBytes);
  fs.mkdirSync(path.join(root,'data','analyses-evidence'),{recursive:true});
  fs.writeFileSync(path.join(root,'data','analyses-evidence',`${ticker}.json`),JSON.stringify(evidence,null,2)+'\n');
}
