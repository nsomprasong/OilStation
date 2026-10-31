import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const adapter=readFileSync('src/adapters/supabase.mjs','utf8');
const sql=readFileSync('supabase/migrations/20261031182000_qa_station_scope_options.sql','utf8');
const stations=[
 ['e22fb5ff-1878-446f-ab8d-585115e8a1a9','d6f31134-2c74-41d8-8bc3-6d83bb41840b'],
 ['76388e2c-ef36-4656-808b-7d0fbd1d2c35','948d946d-aa98-4718-b246-991313371ddb'],
 ['24dc4981-0e6f-4b86-bfd7-03717002d0be','db30c758-533c-463c-a226-d49f032e960a'],
 ['02183a4e-47b0-4575-9f4f-74cec6553205','e5cb8456-5611-421b-8265-229f6b1daa65']
];
test('production preview config pins only the four approved QA station/org pairs in alias order',()=>{
 assert.equal(config.vars.OILSTATION_API_ENABLED,'false');
 assert.equal(config.vars.OILSTATION_DEPLOY_TARGET,'production');
 assert.deepEqual(config.vars.OILSTATION_QA_STATION_IDS.split(','),stations.map(x=>x[0]));
 assert.deepEqual(config.vars.OILSTATION_QA_ORGANIZATION_IDS.split(','),stations.map(x=>x[1]));
 assert.deepEqual(config.vars.OILSTATION_QA_COMPANY_IDS.split(','),["4e6a3fc9-217d-4543-885b-113f1f3ba4c3","7f3dae09-5ff4-409c-bdf8-049086f99b7a","ff5796e7-e567-4790-aec6-0d5101fcd884","ab0a1f24-9a15-4a00-9da8-0a09397e4b24","4b19a8db-6b66-4707-8c5e-46648adbbe31","86bec094-71b8-4d9c-bea8-fdeed7c2ca66","9f202115-6bdd-47d9-a7a0-81ee9a7a1cc6","963161ff-078a-4176-8762-47daf1075d20","c55f48a5-76b2-478f-97ea-727f03ed2a9d","9da2618b-151c-45df-aad6-16519ec76535","9b6da1cc-946f-4756-8e0e-8ce020ca6209","88a9d686-e2c3-4cef-8a2a-1a888354a4c7"]);
 assert.equal(new Set(config.vars.OILSTATION_QA_COMPANY_IDS.split(',')).size,12);
 assert.ok(!JSON.stringify(config.vars).includes('bde8e062-8ec5-44bd-91c1-9a4711ed25e5'));
});
test('QA scope listing never reads tenant tables directly or bypasses permissions',()=>{
 assert.match(adapter,/rpc\/oilstation_qa_scope_options/);
 assert.match(adapter,/p_qa_run_id:env\.OILSTATION_QA_RUN_ID/);
 assert.match(sql,/cardinality\(p_station_ids\)<>4/);
 assert.match(sql,/cardinality\(p_organization_ids\)<>4/);
 assert.match(sql,/cardinality\(p_company_ids\)>12/);
 assert.match(sql,/s\.name=v_expected\[v_idx\]/);
 assert.match(sql,/s\.organization_id=p_organization_ids\[v_idx\]/);
 assert.match(sql,/a\.station_id=p_station_ids\[v_company_station_idx\]/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|ALL) ON TABLE|INSERT INTO|UPDATE public\.|DELETE FROM/i);
 assert.doesNotMatch(adapter,/\?select=id,name&id=in\./);
});
