/* Accepted Stage 2B rule inventory and canonical serializer, limited to browser validation. */
export const DCAP_V2 = (function () {
  'use strict';
  var VERSION = '2B.1.0';
  var MAP_VERSION = 'stage2a-confirmed-plus-explicit-note-parser-1';
  var definitions = [
    ['Triple Trouble','Taxi',3],['Triple Trouble','Map Spammer',5],
    ['Triple Trouble','Blocker',3],['Triple Trouble','Setup',3],['Triple Trouble','Commander',3],
    ['DBS','Derv Escort',2],['DBS','Doordash / Feed',2],
    ['BFLA','Commander',3],['BFLA','Sub/Lane Lead',2],
    ['Twisted Marionette','Commander',4],['Dragonstorm','Commander',2],
    ["Dragon's Stand",'Commander',3],['WvW','Commander',5],
    ['Gyala Delve','Commander',5],['Gyala Delve','Map Spammer',5],
    ['Guild Missions','Commander',5],['Aetherblade Assault','Commander',2],
    ["Dragon's End",'Commander',5],["Dragon's End",'Sub/Lane Lead',3],
    ['CM Convergence','Commander',5],['CM Convergence','Sub/Lane Lead',2],
    ['Defense of Amnytas','Commander',4],['Secrets of the Weald','Commander',4],
    ['All events','Student',2],['Actual event retained','Other Commander',null]
  ];
  var RULES = definitions.map(function (d,i) {return {id:'V2-'+String(i+1).padStart(2,'0'),
    version:'DCAP Points v2.0',event:d[0],role:d[1],points:d[2]};});
  var NONSTACK = ['BFLA',"Dragon's End",'CM Convergence'];
  function fail(msg) {throw new Error(msg);}
  function stable(v) {
    if (Array.isArray(v)) return '['+v.map(stable).join(',')+']';
    if (v && typeof v==='object') return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';
    if (v===undefined || (typeof v==='number' && !Number.isFinite(v))) fail('Invalid canonical value');
    return JSON.stringify(v);
  }
  return { version: VERSION, mappingVersion: MAP_VERSION, rules: RULES, stable };
}());
