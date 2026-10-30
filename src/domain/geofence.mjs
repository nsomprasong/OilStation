/** Advisory geometry; server SQL independently verifies GPS and keeps records pending. */
export function evaluateGeofence({latitude,longitude,accuracyMeters,stationLatitude,stationLongitude,radiusMeters=150,maxAccuracyMeters=100}){
 const coords=[latitude,longitude,stationLatitude,stationLongitude];
 if(coords.some(n=>typeof n!=='number'||!Number.isFinite(n))||
    Math.abs(latitude)>90||Math.abs(stationLatitude)>90||
    Math.abs(longitude)>180||Math.abs(stationLongitude)>180)
   return {status:'unconfigured',distanceMeters:null};
 if(!Number.isFinite(radiusMeters)||radiusMeters<30||radiusMeters>1500||
    !Number.isFinite(maxAccuracyMeters)||maxAccuracyMeters<1||maxAccuracyMeters>500)
   throw new RangeError('invalid_geofence_configuration');
 if(!Number.isFinite(accuracyMeters)||accuracyMeters<0||accuracyMeters>1000)
   return {status:'uncertain',distanceMeters:null};
 const rad=Math.PI/180;
 const a=Math.sin((stationLatitude-latitude)*rad/2)**2+
    Math.cos(latitude*rad)*Math.cos(stationLatitude*rad)*
    Math.sin((stationLongitude-longitude)*rad/2)**2;
 const distanceMeters=6371000*2*Math.asin(Math.sqrt(Math.min(1,a)));
 return {status:accuracyMeters>maxAccuracyMeters?'uncertain':
    distanceMeters+accuracyMeters<=radiusMeters?'inside':
    distanceMeters-accuracyMeters>radiusMeters?'outside':'uncertain',
   distanceMeters:Math.round(distanceMeters)};
}
