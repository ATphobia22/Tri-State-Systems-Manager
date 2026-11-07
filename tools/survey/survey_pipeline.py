#!/usr/bin/env python3
"""Offline survey interchange and computations. Outputs are informational evidence."""
import argparse
import hashlib
import json
import math
import struct
import subprocess
from pathlib import Path


def finite(values):
    values = tuple(float(x) for x in values)
    if not all(math.isfinite(x) for x in values):
        raise ValueError('nonfinite measurement')
    return values


def sha(data):
    return hashlib.sha256(data).hexdigest()


def import_landxml(path, xsd=None):
    from lxml import etree
    if Path(path).stat().st_size > 64 * 1024 * 1024:
        raise ValueError('XML exceeds 64 MiB intake limit')
    data = Path(path).read_bytes()
    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True)
    root = etree.fromstring(data, parser)
    if root.getroottree().docinfo.doctype or any(isinstance(n, etree._Entity) for n in root.iter()):
        raise ValueError('DTD/entities are not permitted')
    namespace = etree.QName(root).namespace
    version = root.get('version')
    if etree.QName(root).localname != 'LandXML' or version not in ('1.0', '1.1', '1.2', '2.0') or namespace != 'http://www.landxml.org/schema/LandXML-' + version:
        raise ValueError('unsupported LandXML root/version/namespace')
    ns = {'l': namespace}
    units = root.find('l:Units', ns)
    if units is None or len(units) != 1:
        raise ValueError('exactly one units declaration is required')
    linear = units[0].get('linearUnit')
    if linear not in ('meter', 'foot', 'USSurveyFoot'):
        raise ValueError('unsupported or absent linearUnit')
    schema = {'status': 'NOT_VALIDATED'}
    if xsd:
        # Schemas are supplied and trusted by the operator, never fetched from XML URLs.
        schema_data = Path(xsd).read_bytes()
        schema_root = etree.fromstring(schema_data, parser)
        if schema_root.getroottree().docinfo.doctype or schema_root.xpath('//*[local-name()="include" or local-name()="import" or local-name()="redefine"]'):
            raise ValueError('use a self-contained local schema without imports or DTD')
        etree.XMLSchema(schema_root).assertValid(root)
        schema = {'status': 'VALID_AGAINST_SUPPLIED_XSD', 'sha256': sha(schema_data)}
    def point(node):
        values = finite(node.text.split())
        if len(values) != 3:
            raise ValueError('3D points require northing easting elevation')
        n, e, z = values
        return [e, n, z]
    def points(nodes):
        result = {}
        for node in nodes:
            key = node.get('id') or node.get('name')
            if not key or key in result:
                raise ValueError('missing/duplicate point identifier')
            result[key] = point(node)
        return result
    surfaces = []
    names = set()
    for surface in root.findall('l:Surfaces/l:Surface', ns):
        name = surface.get('name')
        if not name or name in names:
            raise ValueError('missing/duplicate surface name')
        names.add(name)
        definition = surface.find('l:Definition', ns)
        if definition is None or definition.get('surfType') != 'TIN':
            raise ValueError('only explicit TIN surfaces supported')
        vertices = points(definition.findall('l:Pnts/l:P', ns))
        faces = []
        for face in definition.findall('l:Faces/l:F', ns):
            if face.get('i') == '1':
                continue  # LandXML invisible faces are excluded from the presentation mesh.
            ids = face.text.split()
            if len(ids) != 3 or len(set(ids)) != 3 or any(i not in vertices for i in ids):
                raise ValueError('invalid TIN face reference')
            a, b, c = (vertices[i] for i in ids)
            if (b[0]-a[0])*(c[1]-a[1]) == (b[1]-a[1])*(c[0]-a[0]):
                raise ValueError('degenerate TIN face')
            faces.append(ids)
        surfaces.append({'name': name, 'points': vertices, 'faces': faces, 'originalSurfaceXml': etree.tostring(surface, encoding='unicode')})
    preserved = {}
    for tag in ('Alignments', 'Parcels', 'PipeNetworks', 'Survey', 'CoordinateSystem'):
        preserved[tag] = [etree.tostring(n, encoding='unicode') for n in root.findall('l:' + tag, ns)]
    return {'format': 'tsm-survey-v1', 'sourceSha256': sha(data), 'schema': schema,
            'landxmlVersion': version, 'linearUnit': linear, 'axisOrder': 'E,N,Z',
            'verticalDatum': 'UNVERIFIED', 'horizontalCRS': 'UNVERIFIED',
            'engineeringUse': False, 'regulatoryUse': False,
            'points': points(root.findall('l:CgPoints/l:CgPoint', ns)),
            'surfaces': surfaces, 'preservedXml': preserved,
            'limitations': ['Preserved XML collections are not computationally interpreted.',
                            'No signature, source authority or datum acceptance inferred.']}


def inverse(a, b):
    ax, ay = finite(a); bx, by = finite(b)
    dx, dy = bx-ax, by-ay
    if dx == dy == 0:
        raise ValueError('bearing undefined for coincident points')
    return {'distance': math.hypot(dx, dy), 'azimuthDegrees': math.degrees(math.atan2(dx, dy)) % 360}


def forward(a, azimuth, distance):
    x, y = finite(a); azimuth, distance = finite((azimuth, distance))
    if distance < 0:
        raise ValueError('negative distance')
    angle = math.radians(azimuth)
    return [x + distance*math.sin(angle), y + distance*math.cos(angle)]


def adjust(design, observations, covariance):
    """Whiten full correlated observation covariance; solve with SVD, never invert normals."""
    import numpy as np
    A, l, C = (np.asarray(x, dtype=float) for x in (design, observations, covariance))
    if A.ndim != 2 or l.shape != (A.shape[0],) or C.shape != (len(l), len(l)) or not all(np.isfinite(x).all() for x in (A,l,C)):
        raise ValueError('invalid adjustment dimensions/values')
    if not np.allclose(C, C.T, rtol=1e-12, atol=1e-15):
        raise ValueError('covariance must be symmetric')
    L = np.linalg.cholesky(C)
    W, y = np.linalg.solve(L, A), np.linalg.solve(L, l)
    x, _, rank, singular = np.linalg.lstsq(W, y, rcond=None)
    if rank != A.shape[1] or rank == 0:
        raise ValueError('rank deficient: explicit datum constraints required')
    _, s, vt = np.linalg.svd(W, full_matrices=False)
    Q = (vt.T / (s*s)) @ vt
    residuals = A @ x - l
    whitened = np.linalg.solve(L, residuals)
    dof = len(l) - rank
    return {'parameters': x.tolist(), 'residuals': residuals.tolist(),
            'parameterCovarianceFromInput': Q.tolist(), 'degreesOfFreedom': dof,
            'varianceFactor': float(whitened @ whitened / dof) if dof > 0 else None,
            'rank': int(rank), 'conditionNumber': float(singular[0]/singular[-1]),
            'acceptance': 'REVIEW_REQUIRED', 'regulatoryUse': False}


def leveling_network(observations, fixed):
    """Observation: [from, to, height difference, standard deviation], in one unit."""
    if not fixed:
        raise ValueError('at least one fixed benchmark required')
    fixed = {k: finite([v])[0] for k,v in fixed.items()}
    names = sorted({o[i] for o in observations for i in (0,1)} - set(fixed))
    if not names:
        raise ValueError('no unknown heights')
    lookup = {k:i for i,k in enumerate(names)}
    rows, values, variances = [], [], []
    for start, end, delta, sigma in observations:
        delta, sigma = finite((delta,sigma))
        if sigma <= 0 or start == end:
            raise ValueError('invalid leveling observation')
        row = [0.] * len(names)
        value = delta
        for point, sign in ((end,1.),(start,-1.)):
            if point in fixed:
                value -= sign*fixed[point]
            else:
                row[lookup[point]] += sign
        rows.append(row); values.append(value); variances.append(sigma*sigma)
    covariance = [[v if i==j else 0. for j in range(len(values))] for i,v in enumerate(variances)]
    result = adjust(rows, values, covariance)
    result['adjustedHeights'] = {**fixed, **dict(zip(names,result['parameters']))}
    return result


def transform_xy(points, source, target):
    """Horizontal-only PROJ conversion; never imply unchanged Z was datum-transformed."""
    from pyproj import CRS, Transformer, network, __version__, proj_version_str
    network.set_network_enabled(False)
    src, dst = CRS(source), CRS(target)
    if len(src.axis_info) != 2 or len(dst.axis_info) != 2:
        raise ValueError('horizontal-only adapter requires 2D CRS')
    transformer = Transformer.from_crs(src, dst, always_xy=True, allow_ballpark=False, only_best=True)
    output = [list(finite(transformer.transform(*finite(p), errcheck=True))) for p in points]
    return {'points': output, 'sourceWkt': src.to_wkt(), 'targetWkt': dst.to_wkt(),
            'operation': transformer.get_last_used_operation().definition if points else None,
            'pyprojVersion': __version__, 'projVersion': proj_version_str,
            'networkEnabled': False, 'verticalTransformation': 'NOT_PERFORMED', 'regulatoryUse': False}


def geodesic(a, b):
    from geographiclib.geodesic import Geodesic
    lat1, lon1 = finite(a); lat2, lon2 = finite(b)
    if abs(lat1)>90 or abs(lat2)>90 or abs(lon1)>180 or abs(lon2)>180:
        raise ValueError('invalid latitude/longitude')
    return Geodesic.WGS84.Inverse(lat1, lon1, lat2, lon2)


def execute_solver(executable, input_path, arguments=(), timeout=120):
    """Explicit local process adapter. Successful execution does not imply accepted adjustment."""
    executable = Path(executable).resolve(strict=True)
    data = Path(input_path).read_bytes()
    result = subprocess.run([str(executable), *arguments, str(Path(input_path).resolve())],
                            capture_output=True, text=True, timeout=timeout, check=False)
    return {'executableSha256': sha(executable.read_bytes()), 'inputSha256': sha(data),
            'returncode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr,
            'status': 'EXECUTED' if result.returncode == 0 else 'FAILED',
            'scientificAcceptance': 'NOT_ESTABLISHED'}


def export_glb(surface, unit, output):
    """Local-origin glTF Y-up TIN presentation; original engineering coordinates remain in JSON."""
    factor = {'meter': 1., 'foot': .3048, 'USSurveyFoot': 1200/3937}[unit]
    points = surface['points']; keys = list(points)
    if not keys or not surface['faces']:
        raise ValueError('empty surface')
    origin = points[keys[0]]
    vertices = [[(p[0]-origin[0])*factor, (p[2]-origin[2])*factor, -(p[1]-origin[1])*factor] for p in points.values()]
    lookup = {k:i for i,k in enumerate(keys)}
    indices = [lookup[k] for face in surface['faces'] for k in face]
    positions = b''.join(struct.pack('<3f', *finite(p)) for p in vertices)
    binary = positions + struct.pack('<'+'I'*len(indices), *indices)
    doc = {'asset': {'version':'2.0','generator':'TSM survey presentation'}, 'scene':0,
           'scenes':[{'nodes':[0]}], 'nodes':[{'mesh':0}],
           'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'material':0}]}],
           'materials':[{'doubleSided':True,'pbrMetallicRoughness':{'metallicFactor':0.,'roughnessFactor':1.}}],
           'buffers':[{'byteLength':len(binary)}],
           'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(positions),'target':34962},
                          {'buffer':0,'byteOffset':len(positions),'byteLength':len(binary)-len(positions),'target':34963}],
           'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices),'type':'VEC3',
                         'min':[min(p[i] for p in vertices) for i in range(3)],'max':[max(p[i] for p in vertices) for i in range(3)]},
                        {'bufferView':1,'componentType':5125,'count':len(indices),'type':'SCALAR'}],
           'extras':{'sourceOriginENZ':origin,'sourceLinearUnit':unit,'engineeringUse':False,'regulatoryUse':False}}
    encoded = json.dumps(doc,separators=(',',':')).encode(); encoded += b' '*(-len(encoded)%4)
    body = struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
    Path(output).write_bytes(struct.pack('<4sII',b'glTF',2,12+len(body))+body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    intake = sub.add_parser('import-landxml')
    intake.add_argument('input'); intake.add_argument('--output', required=True)
    intake.add_argument('--xsd'); intake.add_argument('--glb-directory')
    for name in ('adjust', 'leveling', 'transform', 'geodesic', 'cogo'):
        command = sub.add_parser(name)
        command.add_argument('input'); command.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'import-landxml':
        result = import_landxml(args.input, args.xsd)
        if args.glb_directory:
            out = Path(args.glb_directory); out.mkdir(parents=True, exist_ok=True)
            for i, surface in enumerate(result['surfaces']):
                export_glb(surface, result['linearUnit'], out / f'surface-{i}.glb')
    else:
        data = json.loads(Path(args.input).read_text())
        if args.command == 'adjust':
            result = adjust(data['design'], data['observations'], data['covariance'])
        elif args.command == 'leveling':
            result = leveling_network(data['observations'], data['fixed'])
        elif args.command == 'transform':
            result = transform_xy(data['points'], data['sourceCRS'], data['targetCRS'])
        elif args.command == 'geodesic':
            result = geodesic(data['a'], data['b'])
        else:
            result = inverse(data['a'], data['b'])
        result['inputSha256'] = sha(Path(args.input).read_bytes())
    Path(args.output).write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')


if __name__ == '__main__':
    main()
