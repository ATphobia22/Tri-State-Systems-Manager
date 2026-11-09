/** TSM Government Data Fabric: Node 22+, zero dependencies, read-only.
 * Live HTTP is opt-in at runtime. Source data are never regulatory approval.
 */
import { createHash } from "node:crypto";

export const GOVERNMENT_SOURCES = Object.freeze({
  FEMA: { NFHL:"fema.nfhl", RISKMAP:"fema.riskmap", LOMA:"fema.loma", LOMR:"fema.lomr" },
  NOAA: { WEATHER:"noaa.weather", ALERTS:"noaa.alerts", OBSERVATIONS:"noaa.observations", TIDES:"noaa.tides", DATUMS:"noaa.datums", GEOID:"noaa.geoid" },
  USGS: { TOPOVIEW:"usgs.topoview", TOPO:"usgs.topo", DEM_3DEP:"usgs.3dep", NHD:"usgs.nhd", PUBLICATIONS:"usgs.publications", STREAMGAGES:"usgs.streamgages" },
  CENSUS: { TIGER:"census.tiger" }, EPA: { WATERS:"epa.waters", FACILITIES:"epa.facilities" },
  USDA: { SSURGO:"usda.ssurgo", CROPLAND:"usda.cropland" }, USACE: { LEVEES:"usace.levees" }
});
export const NFHL_LAYERS = Object.freeze({
  FLOOD_ZONES:"Flood Hazard Zones", FLOOD_BOUNDARIES:"Flood Hazard Boundaries",
  LEVEES:"Levees", CROSS_SECTIONS:"Cross Sections", WATER_AREAS:"Water Areas",
  JURISDICTIONS:"Political Jurisdictions", BFES:"Base Flood Elevations",
  LOMA:"LOMAs", LOMR:"LOMRs"
});
export const MAP_LAYERS = Object.freeze({
  FEMA:["Flood Zones","Levees","BFEs","LOMA","LOMR"],
  NOAA:["Weather","Radar","Warnings","Tides"],
  USGS:["3DEP DEM","Hydrography","Topography","Geology"],
  USDA:["SSURGO Soils","Cropland"], EPA:["Watersheds","Water Systems"],
  CENSUS:["TIGER Roads","State Boundaries","Counties","Census Tracts"]
});
const ENDPOINTS = Object.freeze({
  "noaa.weather":"https://api.weather.gov",
  "noaa.alerts":"https://api.weather.gov",
  "noaa.observations":"https://api.weather.gov",
  "usgs.streamgages":"https://waterservices.usgs.gov",
  "usgs.3dep":"https://tnmaccess.nationalmap.gov",
  "fema.nfhl":"https://hazards.fema.gov"
});
const assertPoint=(lat,lon)=>{
  if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lon)||lon < -180||lon > 180)
    throw new RangeError("Invalid latitude/longitude");
};
const assertStation=id=>{if(!/^[A-Za-z0-9-]{2,24}$/.test(id))throw new Error("Invalid station identifier");return id};
const assertState=s=>{if(!/^[A-Z]{2}$/.test(s))throw new Error("Expected two-letter state code");return s};
export class GovernmentFabric {
  constructor({fetchImpl=globalThis.fetch,userAgent,now=()=>new Date(),timeoutMs=12000,maxBytes=8_000_000}={}){
    if(typeof fetchImpl!=="function")throw new Error("fetchImpl required");
    if(!userAgent||/example\.com|contact@example/i.test(userAgent))throw new Error("Configure a real NWS User-Agent via TSM_NWS_USER_AGENT");
    this.fetchImpl=fetchImpl;this.userAgent=userAgent;this.now=now;this.timeoutMs=timeoutMs;this.maxBytes=maxBytes;
    this.weather={getForecast:(lat,lon)=>this.getForecast(lat,lon),getAlerts:(state)=>this.getAlerts(state)};
    this.observations={getLatestObservation:id=>this.getLatestObservation(id)};
    this.usgs3dep={searchElevationProducts:bbox=>this.searchElevationProducts(bbox)};
    this.streamgages={getStation:id=>this.getStation(id),getInstantaneousValues:id=>this.getInstantaneousValues(id)};
    this.fema={getLayerCatalog:()=>this.getNfhlLayers()};
  }
  async request(sourceId,url,{classification="OBSERVED"}={}){
    const base=ENDPOINTS[sourceId];if(!base)throw new Error("Source not enabled: "+sourceId);
    const target=new URL(url);
    if(target.protocol!=="https:"||target.origin!==new URL(base).origin||target.username||target.password)
      throw new Error("Untrusted agency endpoint");
    const retrievedAt=this.now().toISOString();
    const response=await this.fetchImpl(target.toString(),{
      headers:{"User-Agent":this.userAgent,"Accept":"application/geo+json, application/json"},
      signal:AbortSignal.timeout(this.timeoutMs),redirect:"error"
    });
    if(!response.ok)throw new Error(`Agency ${sourceId} HTTP ${response.status}`);
    const declared=Number(response.headers?.get?.("content-length"));
    if(Number.isFinite(declared)&&declared>this.maxBytes)throw new Error("Payload too large");
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength>this.maxBytes)throw new Error("Payload too large");
    const responseHash=createHash("sha256").update(bytes).digest("hex");
    const data=JSON.parse(new TextDecoder().decode(bytes));
    if(data?.error)throw new Error("Agency returned an error object");
    return {sourceId,classification,verification:"PROVISIONAL",data,
      evidence:{sourceId,endpoint:target.toString(),retrievedAt,responseHash,
        horizontalDatum:null,verticalDatum:null,datasetVersion:null,
        contentType:response.headers?.get?.("content-type")??null},
      regulatoryUse:false};
  }
  async getForecast(latitude,longitude){
    assertPoint(latitude,longitude);
    const point=await this.request("noaa.weather",`https://api.weather.gov/points/${latitude},${longitude}`);
    const url=point.data?.properties?.forecast;
    if(typeof url!=="string")throw new Error("NWS point has no forecast URL");
    const forecast=await this.request("noaa.weather",url,{classification:"DERIVED"});
    return {...forecast,dependencies:[point.evidence]};
  }
  getAlerts(state){return this.request("noaa.alerts",`https://api.weather.gov/alerts/active?area=${assertState(state)}`);}
  getLatestObservation(stationId){return this.request("noaa.observations",`https://api.weather.gov/stations/${assertStation(stationId)}/observations/latest`);}
  getStation(stationId){return this.request("usgs.streamgages",`https://waterservices.usgs.gov/nwis/site/?format=json&sites=${assertStation(stationId)}`);}
  getInstantaneousValues(stationId){return this.request("usgs.streamgages",`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${assertStation(stationId)}`);}
  searchElevationProducts(bbox){
    const nums=Array.isArray(bbox)?bbox:String(bbox).split(",").map(Number);
    if(nums.length!==4||nums.some(n=>!Number.isFinite(n))||nums[0]>=nums[2]||nums[1]>=nums[3])throw new Error("Invalid bbox");
    assertPoint(nums[1],nums[0]);assertPoint(nums[3],nums[2]);
    const url=new URL("https://tnmaccess.nationalmap.gov/api/v1/products");
    url.searchParams.set("datasets","Digital Elevation Model (DEM) 1 meter");
    url.searchParams.set("bbox",nums.join(","));
    return this.request("usgs.3dep",url.toString(),{classification:"DERIVED"});
  }
  getNfhlLayers(){
    return this.request("fema.nfhl","https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson",{classification:"REGULATORY"});
  }
}
export const createGovernmentFabric=(options={})=>new GovernmentFabric({
  userAgent:process.env.TSM_NWS_USER_AGENT,...options
});
