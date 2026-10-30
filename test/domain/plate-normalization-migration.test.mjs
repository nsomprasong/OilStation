import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePlate,evaluatePlateOcr} from '../../src/domain/plate-ocr.mjs';
const file=readFileSync(new URL('../../supabase/migrations/20261029194000_thai_plate_normalization.sql',import.meta.url),'utf8');
test('Thai vehicle normalization accepts different Thai digits and punctuation but no fuzzy mismatch',()=>{
 assert.equal(normalizePlate('กข-๑๒๓๔'),normalizePlate(' กข 1234 '));
 assert.equal(evaluatePlateOcr({text:'กข 1235',confidence:1,expectedPlate:'กข๑๒๓๔'}).verified,false);
});
test('SQL start and checked-photo use the exact same DB plate normalizer',()=>{
 assert.match(file,/normalize_oilstation_plate\(p_verified_plate\)/);
 assert.match(file,/normalize_oilstation_plate\(pc\.observed_plate\)/);
 assert.match(file,/normalize_oilstation_plate\(c\.plate_snapshot\)/);
 assert.match(file,/verified_ocr/);
 assert.match(file,/verified_supervisor/);
 assert.match(file,/storage\.objects/);
 assert.doesNotMatch(file,/CREATE OR REPLACE FUNCTION public\.finish_reserved_fuel_session/);
});
