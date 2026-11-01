import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

// Generated files only. Never relax permissions, skip a write or swallow failure.
// Windows occasionally rejects an open while the local filesystem is busy.
export function createGeneratedWriter({write=writeFile,wait=delay,platform=process.platform}={}) {
  return async (...args)=>{
    for(let attempt=0;;attempt++)try{return await write(...args);}catch(error){
      if(platform!=='win32'||attempt>=2||!['UNKNOWN','EBUSY','EPERM'].includes(error.code))throw error;
      await wait(25*(attempt+1));
    }
  };
}
export const writeGeneratedFile=createGeneratedWriter();
