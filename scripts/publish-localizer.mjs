import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const FILES=['mlb-resolucoes.json','.mercadolivre-token.enc'];

export function publishLocalizer(cwd=process.cwd()) {
  const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  if(!git('status','--porcelain','--',...FILES)) return {changed:false};
  const payload=JSON.parse(readFileSync(cwd+'/mlb-resolucoes.json','utf8'));
  if(!payload.resultados || typeof payload.resultados!=='object' || Array.isArray(payload.resultados)) {
    throw Error('Resultados inválidos; publicação interrompida, arquivos preservados.');
  }
  const base=git('rev-parse','HEAD');
  const previous=JSON.parse(git('show',base+':mlb-resolucoes.json'));
  if(Object.keys(previous.resultados||{}).some(id=>!Object.hasOwn(payload.resultados,id))) {
    throw Error('A publicação removeria resultados existentes; arquivos preservados para revisão.');
  }
  git('fetch','origin','main');
  const remote=git('rev-parse','refs/remotes/origin/main');
  if(git('diff','--name-only',base,remote,'--',...FILES)) {
    // Nunca escolher automaticamente um refresh token ou sobrescrever uma fila
    // concorrente. O workflow guarda os dois arquivos como artefato de recuperação.
    throw Error('O token criptografado ou os resultados mudaram no remoto; não sobrescritos. Recupere a cópia desta execução e revise antes de publicar.');
  }
  git('add','--',...FILES);
  git('commit','-m','Atualiza localizador de codigos MLB');
  if(remote!==base) git('rebase',remote);
  // Sem force. Uma corrida após o fetch será recusada pelo próprio servidor.
  git('push','origin','HEAD:main');
  return {changed:true};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {console.log(publishLocalizer().changed?'Resultados publicados com segurança.':'Nenhum novo resultado para publicar.');}
  catch {console.error('Publicação não concluída. Não foi usado force-push nem selecionado token por preferência. Consulte a cópia de recuperação e as alterações remotas.');process.exitCode=1;}
}
