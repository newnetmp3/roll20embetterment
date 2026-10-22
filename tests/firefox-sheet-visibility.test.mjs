import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const source=readFileSync(join(resolve(import.meta.dirname,'..'),
  'extension/firefox/sheet-visibility.js'),'utf8');
function harness(){
  const operations=[],storage=new Map();
  const context={
    Date,console,localStorage:{
      getItem:key=>storage.get(key)||null,
      setItem:(key,value)=>storage.set(key,value)
    },
    document:{querySelectorAll:()=>[],addEventListener(){}},
    r3StorageKey:()=> 'game-test',
    R3_AUTO:{generation:0},
    r3AutoRestoreDialog:()=>operations.push('restore-auto'),
    r3NativeBgRestoreAll:()=>operations.push('restore-native'),
    r3CancelOwnedScans:()=>operations.push('cancel-scan'),
    r3NativeStatus:()=>{},r3HudRender:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(source+'\nglobalThis.sheetApi={R3_SHEET_VIS,'+
    'r3SheetRevealAll,r3SheetAllowsBackground,r3SheetAllowPrivateReaders,'+
    'r3SheetOnPlayerJournal,r3SheetVisibilityInstall};',context);
  return {api:context.sheetApi,operations,storage,context};
}
test('manual Journal access cancels background traversal but is not a sticky auto-sync opt out',()=>{
  const h=harness();
  h.api.r3SheetRevealAll(true);
  assert.deepEqual(h.operations,['cancel-scan','restore-auto','restore-native']);
  assert.equal(h.api.R3_SHEET_VIS.manualPriority,false);
  assert.equal(h.api.r3SheetAllowsBackground(),false,'allow the manual sheet to open first');
  assert.equal(h.storage.size,0,'normal player-open never writes a permanent preference');
  h.api.R3_SHEET_VIS.manualUntil=0;
  assert.equal(h.api.r3SheetAllowsBackground(),true,'private sync resumes after manual grace');
});
test('explicit Debug restore remains sticky until player re-enables private readers',()=>{
  const h=harness();
  h.api.r3SheetRevealAll();
  assert.equal(h.api.R3_SHEET_VIS.manualPriority,true);
  assert.equal(h.api.r3SheetAllowsBackground(),false);
  assert.equal(h.storage.get('game-test:manual-sheet-priority:v1'),'true');
  h.api.r3SheetAllowPrivateReaders();
  assert.equal(h.api.r3SheetAllowsBackground(),true);
  assert.equal(h.storage.get('game-test:manual-sheet-priority:v1'),'false');
});
test('only real trusted Roll20 Journal actions interrupt an automatic scan',()=>{
  const h=harness(),row={closest:()=>({})};
  const event={type:'pointerdown',isTrusted:false,target:row};
  h.api.r3SheetOnPlayerJournal(event);
  assert.equal(h.operations.length,0);
  h.api.r3SheetOnPlayerJournal({...event,isTrusted:true});
  assert.equal(h.operations[0],'cancel-scan');
});
