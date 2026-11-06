/** Pure isolation preflight; not a billing group mutation. */
export function previewSaasGroupIsolation({targetStationId,stationIds,existingInvoiceStationIds}){
 if(typeof targetStationId!=='string'||!targetStationId.trim())throw new TypeError('invalid station');
 if(!Array.isArray(stationIds)||!Array.isArray(existingInvoiceStationIds))
  throw new TypeError('invalid group member list');
 if(stationIds.length>500||existingInvoiceStationIds.length>500)throw new RangeError('group too large');
 if(stationIds.some(x=>typeof x!=='string'||!x.trim())||
    existingInvoiceStationIds.some(x=>typeof x!=='string'||!x.trim()))
  throw new TypeError('invalid member');
 if(new Set(stationIds).size!==stationIds.length)throw new RangeError('duplicate station membership');
 if(!stationIds.includes(targetStationId))throw new RangeError('station not part of group');
 const unaffected=stationIds.filter(id=>id!==targetStationId);
 return Object.freeze({targetStationId,unaffectedStationIds:Object.freeze(unaffected),
  invoiceStationIdsUnchanged:Object.freeze([...existingInvoiceStationIds]),
  canMutateInvoices:false});
}
