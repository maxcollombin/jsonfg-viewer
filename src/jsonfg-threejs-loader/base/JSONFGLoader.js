import { Vector3 } from 'three';
import {
	BufferAttribute,
	BufferGeometry,
	Group,
	Matrix4 } from 'three';
import proj4 from 'proj4';
const defs = require("proj4js-definitions");
// import defs  from "./defs.js";

// import { FeatureParser } from '../parsers/FeatureParser.js';

function utmzone_from_lon(lon_deg) {
	//get utm-zone from longitude degrees
	return parseInt(((lon_deg+180)/6)%60)+1;
}

function proj4_setdef(lon_deg) {
	//get UTM projection definition from longitude
	const utm_zone = utmzone_from_lon(lon_deg);
	const zdef = `+proj=utm +zone=${utm_zone} +datum=WGS84 +units=m +no_defs`;
	return zdef;
}

export class JSONFGLoader {

	constructor( parser ) {

		// this.texturesPath = '';
		this.scene = new Group();
		this.matrix = null;
		this.boundingBox = null;
		this.parser = parser;// || new FeatureParser();

		// Load proj4 defs
		proj4.defs(defs);
		proj4.defs("EPSG:6661","+proj=utm +zone=18 +ellps=GRS80 +units=m +vunits=m +no_defs +type=crs");
		proj4.defs("EPSG:7415","+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.999908 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +no_defs +no_defs");
		proj4.defs("EPSG:2056","+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs +type=crs");
		proj4.defs("OGC:CRS84","+proj=longlat +datum=WGS84 +no_defs +type=crs");
		this.targetCRS = "EPSG:4326";

	}

	// setTexturesPath( path ) {

	// 	this.texturesPath = path;

	// }

	load( data ) {

		if ( typeof data === "object" ) {

			// We dee[] clone the object to avoid modifying the original
			// objects vertices
			let new_data = JSON.parse(JSON.stringify(data));

			this.reprojectData( new_data );

			if ( this.matrix == null && new_data.features.length > 0 ) {

				this.computeMatrix( new_data.features );

			}

			this.parser.matrix = this.matrix;
			this.parser.parse( new_data, this.scene );

		}

	}

	reprojectData( data ) {
		console.log(data.coordRefSys);
		if (data.coordRefSys) {
			if (data.coordRefSys.includes("//www.opengis.net/def/crs/EPSG/0/")) {
				const epsgCode = data.coordRefSys.split("/").at(-1);
				// const epsgCode = theCRS.match(/^[0-9]+$/);
				this.targetCRS = 'EPSG:' + epsgCode;
			} else if (data.coordRefSys.includes("//www.opengis.net/def/crs/OGC/0/")){
				let theCRS = data.coordRefSys.split("/").at(-1);
				if(theCRS==="CRS84h") theCRS="CRS84";
				this.targetCRS = 'OGC:' + theCRS;
			} else {
				console.error("Unsupported coordRefSys string");
			}
			try {
				proj4(this.targetCRS);
			} catch (error) {
				console.error("Unknown CRS: " + error);
			}
		} else return;
		const coordRefSys = this.targetCRS;
		console.log(proj4.defs)
		const targetDef = proj4.defs(this.targetCRS);
		if (!targetDef || !targetDef.projName) {
			console.error("Unknown/unsupported CRS: " + this.targetCRS + ", geometry not reprojected");
			return;
		}
		if (targetDef.projName === "longlat") {
			let longitude = null;
			if (data.features[0].place)
				longitude = data.features[0].place.coordinates.flat(5)[0]
			else
				longitude = data.features[0].geometry.coordinates.flat(5)[0]
			const utmZone = utmzone_from_lon(longitude);
			this.targetCRS = "AutoUTM Zone "+utmZone;
			proj4.defs(this.targetCRS, proj4_setdef(longitude));
		}

		// let context = this;
		const reprojectCoordinates = (fromCRS, coords) => coords.map(geom => {
			if (typeof geom[0] === 'number') {
				return proj4(fromCRS, this.targetCRS, geom);
			} else
				return reprojectCoordinates(fromCRS, geom);
		});

		// reproject
		for ( const featureID in data.features ) {
			let feature = data.features[featureID];
			if(feature.geometry) {
				feature.geometry.coordinates = reprojectCoordinates("EPSG:4326",feature.geometry.coordinates);
			}
			if(feature.place) {
				feature.place.coordinates = reprojectCoordinates(coordRefSys, feature.place.coordinates);
			}
		}
	}

	// applyTransform( data ) {

	// 	// apply CRS transform
	// 	if ( data[ "transform" ] != undefined ) {

	// 		const t = data.transform.translate;
	// 		const s = data.transform.scale;

	// 		const vertices = data.vertices.map( v =>
	// 			[
	// 				v[ 0 ] * s[ 0 ] + t[ 0 ],
	// 				v[ 1 ] * s[ 1 ] + t[ 1 ],
	// 				v[ 2 ] * s[ 2 ] + t[ 2 ]
	// 			]
	// 		);

	// 		return vertices;

	// 	}

	// 	return data.vertices;

	// }

	/**
	 * Computes a matrix that transforms the dataset close to the origin.
	 *
	 * @param {Array} features An array of features to compute the matrix for
	 */
	computeMatrix( features, scale = false ) {

		const normGeom = new BufferGeometry();

		// Sample the first ring/line of the first face of each feature (rather than
		// its full geometry) to keep this cheap on large datasets. Sampling a whole
		// ring instead of a single vertex avoids a degenerate zero-radius bounding
		// sphere when there are few features (e.g. a single-feature file), which
		// would otherwise skip all scaling/centering below.
		const faces = [];
		for ( const feature of features ) {

			if ( feature.hasOwnProperty( 'place' ) ) {

				if ( feature.place !== null ) {

					// TODO: GeometryCollection / CustomGeometry, MultiPrism
					if ( feature.place.type == "MultiPolyhedron" ) faces.push( ...feature.place.coordinates[ 0 ][ 0 ][ 0 ][ 0 ] );
					else if ( feature.place.type == "Polyhedron" ) faces.push( ...feature.place.coordinates[ 0 ][ 0 ][ 0 ] );
					else if ( feature.place.type == "MultiPolygon" ) faces.push( ...feature.place.coordinates[ 0 ][ 0 ] );
					else if ( feature.place.type == "Polygon" || feature.place.type == "MultiLineString" ) faces.push( ...feature.place.coordinates[ 0 ] );
					else if ( feature.place.type == "LineString" || feature.place.type == "MultiPoint" ) faces.push( ...feature.place.coordinates );
					else if ( feature.place.type == "Point" ) faces.push( feature.place.coordinates );
					else if ( feature.place.type == "Prism" ) {
						if ( feature.place.base.type == "Polygon" ) faces.push( ...feature.place.coordinates[ 0 ] );
						else if ( feature.place.base.type == "LineString" ) faces.push( ...feature.place.coordinates );
						else if ( feature.place.base.type == "Point" ) faces.push( feature.place.coordinates );
					}
				}

			}

		}

		const vertices = new Float32Array( faces.flat() );
		normGeom.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );

		normGeom.computeBoundingBox();
		this.boundingBox = normGeom.boundingBox;
		const centre = new Vector3();

		normGeom.boundingBox.getCenter( centre );
		normGeom.computeBoundingSphere();
		const radius = normGeom.boundingSphere.radius;

		// const s = scale ? radius === 0 ? 1 : 1.0 / radius : 1;
		const s = radius === 0 ? 1 : 0.25 / radius;

		const matrix = new Matrix4();
		matrix.set(
			s, 0, 0, - s * centre.x,
			0, s, 0, - s * centre.y,
			0, 0, s, - s * centre.z,
			0, 0, 0, 1
		);

		this.matrix = matrix;

	}

}
