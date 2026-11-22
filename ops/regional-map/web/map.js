const center = [-87.895, 37.9322];
const map = new maplibregl.Map({container:'map', center, zoom:11, pitch:40, style:{
  version:8, glyphs:location.origin+'/tiles/font/{fontstack}/{range}', sprite:location.origin+'/tiles/sprite/icons',
  sources:{
    base:{type:'vector', tiles:[location.origin+'/tiles/tristate-valley/{z}/{x}/{y}'], attribution:'© OpenStreetMap contributors · Protomaps'},
    dem:{type:'raster-dem', encoding:'mapbox',tileSize:256,tiles:[location.origin+'/tiles/tristate-terrain/{z}/{x}/{y}']}},
  terrain:{source:'dem',exaggeration:1}, layers:[
    {id:'land',type:'background',paint:{'background-color':'#e2e4d4'}},
    {id:'relief',type:'hillshade',source:'dem'},
    {id:'water',type:'fill',source:'base','source-layer':'water',paint:{'fill-color':'#75abc3'}},
    {id:'roads',type:'line',source:'base','source-layer':'roads',paint:{'line-color':'#9d7859','line-width':2}},
    {id:'buildings',type:'fill-extrusion',source:'base','source-layer':'buildings',paint:{'fill-extrusion-height':['to-number',['get','height'],0],'fill-extrusion-color':'#a99e91'}}
  ]}});
map.addControl(new maplibregl.NavigationControl());
const output = document.querySelector('output');
const originButton = document.querySelector('#origin');
const routeButton = document.querySelector('#route');
const steps = document.querySelector('#steps');
let selected, origin, marker, startMarker, revision = 0;
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error('Service unavailable ('+response.status+')');
  return response.json();
}
function select(point, address) {
  selected = point;
  if (!marker) marker = new maplibregl.Marker();
  marker.setLngLat(point).addTo(map);
  originButton.disabled = false;
  routeButton.disabled = !origin;
  steps.replaceChildren();
  if (map.getLayer('route')) map.removeLayer('route');
  if (map.getSource('route')) map.removeSource('route');
  output.value = [OpenLocationCode.encode(point[1],point[0],11),point[1].toFixed(6)+', '+point[0].toFixed(6),address].filter(Boolean).join(' · ');
}
map.on('click', async ({lngLat}) => {
  const id = ++revision;
  const point = [lngLat.lng,lngLat.lat];
  select(point,'Looking up address…');
  try {
    const data = await json('/geocode/reverse?format=jsonv2&lat='+point[1]+'&lon='+point[0]);
    if (id===revision) select(point,data.display_name || 'No address match');
  } catch { if (id===revision) select(point,'Address lookup unavailable'); }
});
document.querySelector('form').onsubmit = async event => {
  event.preventDefault();
  const id = ++revision;
  const query = document.querySelector('input').value.trim();
  try {
    let point, address;
    if (OpenLocationCode.isValid(query)) {
      const ref = map.getCenter();
      const full = OpenLocationCode.isFull(query) ? query : OpenLocationCode.recoverNearest(query,ref.lat,ref.lng);
      const area = OpenLocationCode.decode(full);
      point = [area.longitudeCenter,area.latitudeCenter];
    } else {
      const hits = await json('/geocode/search?format=jsonv2&limit=1&q='+encodeURIComponent(query));
      if (!hits.length) throw Error('No address match');
      point = [Number(hits[0].lon),Number(hits[0].lat)];
      address = hits[0].display_name;
    }
    if (id===revision) { select(point,address); map.flyTo({center:point,zoom:16}); }
  } catch(error) { if (id===revision) output.value = error.message; }
};
originButton.onclick = () => {
  ++revision;
  origin = selected.slice();
  select(origin,'Origin set. Select a destination.');
  if (!startMarker) startMarker = new maplibregl.Marker({color:'#496445'});
  startMarker.setLngLat(origin).addTo(map);
  routeButton.disabled = true;
};
routeButton.onclick = async () => {
  const id = ++revision;
  try {
    const data = await json('/routing/route/v1/driving/'+origin.join(',')+';'+selected.join(',')+'?steps=true&overview=full&geometries=geojson');
    if (id!==revision) return;
    if (data.code!=='Ok' || !data.routes.length) throw Error('No driving route found');
    const route = data.routes[0];
    select(selected,'Driving route · '+(route.distance/1000).toFixed(1)+' km');
    map.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},geometry:route.geometry}});
    map.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#2755ab','line-width':4}});
    for (const step of route.legs.flatMap(leg=>leg.steps)) {
      const item = document.createElement('li');
      item.textContent = [step.maneuver.type,step.maneuver.modifier,step.name].filter(Boolean).join(' · ');
      steps.append(item);
    }
  } catch(error) { if (id===revision) output.value = error.message; }
};
