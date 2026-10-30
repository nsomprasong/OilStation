/** Materialize a genuine PNG favicon from the tracked transparent SVG asset.
 * GitHub's repository connector stores UTF-8 text; the self-contained SVG is
 * therefore the source-of-truth, without a build-time remote dependency.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';

const master=new URL('../public/oilstation-gold-logo.svg',import.meta.url);
const output=new URL('../public/oilstation-gold-logo.png',import.meta.url);
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);

function pngCrc32(buffer){
 let crc=0xffffffff;
 for(const byte of buffer){
  crc^=byte;
  for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
export function extractGoldLogoPng(svg){
 const match=svg.match(/<image\b[^>]*href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
 if(!match)throw new Error('Brand asset missing embedded transparent PNG');
 const png=Buffer.from(match[1],'base64');
 if(png.length<128||!png.subarray(0,8).equals(SIGNATURE))
  throw new Error('Invalid OilStation PNG asset');
 let offset=8,foundHeader=false,foundTransparency=false,foundEnd=false;
 const idats=[];
 while(offset+12<=png.length){
  const length=png.readUInt32BE(offset);
  const end=offset+12+length;
  if(end>png.length)throw new Error('Truncated PNG chunk');
  const type=png.toString('ascii',offset+4,offset+8);
  const body=png.subarray(offset+4,offset+8+length);
  const crc=png.readUInt32BE(offset+8+length);
  if(pngCrc32(body)!==crc)throw new Error('PNG asset checksum mismatch: '+type);
  if(type==='IHDR'){
   const width=png.readUInt32BE(offset+8),height=png.readUInt32BE(offset+12);
   if(width!==128||height!==128)throw new Error('Unexpected OilStation icon size');
   foundHeader=true;
  }
  if(type==='tRNS')foundTransparency=true;
  if(type==='IDAT')idats.push(png.subarray(offset+8,offset+8+length));
  offset=end;
  if(type==='IEND'){foundEnd=true;break;}
 }
 if(!foundHeader||!foundTransparency||!foundEnd||!idats.length)
  throw new Error('Incomplete transparent OilStation PNG');
 if(inflateSync(Buffer.concat(idats)).length<128)
  throw new Error('PNG asset image data unreadable');
 return png;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const png=extractGoldLogoPng(readFileSync(master,'utf8'));
 writeFileSync(output,png);
 console.log('OilStation gold favicon ready:',png.length,'bytes');
}
