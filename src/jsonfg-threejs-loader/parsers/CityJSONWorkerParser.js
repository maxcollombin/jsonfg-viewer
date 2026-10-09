import { LineBasicMaterial, Matrix4, PointsMaterial, ShaderLib } from 'three';
import { defaultObjectColors, defaultSemanticsColors } from '../defaults/colors.js';
import { POINTS, LINES, TRIANGLES } from './geometry/GeometryData';
import 'three/examples/jsm/lines/LineMaterial';
import { CityObjectsMaterial } from '../materials/CityObjectsMaterial.js';
import { CityObjectsMesh } from '../objects/CityObjectsMesh.js';
import { CityObjectsLines } from '../objects/CityObjectsLines.js';
import { CityObjectsPoints } from '../objects/CityObjectsPoints.js';
// import { CityObjectsLineMaterial } from '../materials/CityObjectsLineMaterial.js';
// import { CityObjectsPointsMaterial } from '../materials/CityObjectsPointsMaterial.js';
// import { TriangleParser } from './geometry/TriangleParser';
// import { LineParser } from './geometry/LineParser';
// import { PointParser } from './geometry/PointParser';
// import { CityObjectsInstancedMesh } from '../objects/CityObjectsInstancedMesh.js';

// Colour of the lines and points of an object type that has no colour of its own
const DEFAULT_LINE_POINT_COLOR = 0xb71c1c;

/**
 * Splits the vertices of a lines/points chunk by LoD (geometry or place), so
 * that each part can be shown or hidden as a whole. Both vertices of a line
 * segment belong to the same LoD, so segments stay intact.
 */
function splitByLod( vertices, geometryData ) {

	const parts = {};
	const array = new Float32Array( vertices );

	for ( let i = 0; i < geometryData.lodIds.length; i ++ ) {

		const lod = geometryData.lodIds[ i ];

		if ( ! ( lod in parts ) ) {

			parts[ lod ] = { vertices: [], objectIds: [], objectType: [], boundaryIds: [], lodIds: [] };

		}

		const part = parts[ lod ];
		part.vertices.push( array[ 3 * i ], array[ 3 * i + 1 ], array[ 3 * i + 2 ] );
		part.objectIds.push( geometryData.objectIds[ i ] );
		part.objectType.push( geometryData.objectType[ i ] );
		part.boundaryIds.push( geometryData.boundaryIds[ i ] );
		part.lodIds.push( lod );

	}

	return Object.entries( parts ).map( ( [ lod, part ] ) => ( { lod: Number( lod ), ...part } ) );

}

export class CityJSONWorkerParser {

	constructor() {

		this.matrix = null;
		this.onChunkLoad = null;
		this.onComplete = null;
		this.chunkSize = 2000;
		this.loading = false;

		this.objectColors = defaultObjectColors;
		// this.surfaceColors = defaultSemanticsColors;

		// we use the lods mechanism for switching between geometry and place in the jsonfg feature
		this.lods = ['geometry', 'place'];

		this.resetMaterial();

	}

	resetMaterial() {

		this.meshMaterial = new CityObjectsMaterial( ShaderLib.lambert, {
			objectColors: this.objectColors
			// surfaceColors: this.surfaceColors
		} );

		// WebGL draws lines one pixel wide whatever linewidth is set to
		this.lineMaterial = new LineBasicMaterial( { vertexColors: true } );

		this.pointsMaterial = new PointsMaterial( {
			size: 8,
			sizeAttenuation: false,
			vertexColors: true
		} );

	}

	setMaterialsColors( objectColors ) {

		this.meshMaterial.objectColors = objectColors;
		// this.meshMaterial.surfaceColors = surfaceColors;

		// this.lineMaterial.objectColors = objectColors;
		// this.lineMaterial.surfaceColors = surfaceColors;

		// this.pointsMaterial.objectColors = objectColors;
		// this.pointsMaterial.surfaceColors = surfaceColors;

	}

	parse( data, scene ) {

		this.loading = true;

		// Sets the web worker that will parse all normal (ie non-instanced)
		// geometries
		const worker = new Worker( "./helpers/ParserWorker.js" );
		const m = this.matrix;
		const onChunkLoad = this.onChunkLoad;
		const onComplete = this.onComplete;
		const context = this;
		const citymodel = data;

		// followin is executed when we receive a message from the worker
		worker.onmessage = function ( e ) {

			if ( e.data.type === "chunkLoaded" ) {

				const vertices = e.data.v_buffer;
				const geometryData = e.data.geometryData;

				context.setMaterialsColors( e.data.objectColors );

				// context.lods = e.data.lods;
				context.objectColors = e.data.objectColors;
				// context.surfaceColors = e.data.surfaceColors;

				if ( e.data.geometryData.geometryType == TRIANGLES ) {

					const mesh = new CityObjectsMesh( citymodel, vertices, geometryData, m, context.meshMaterial );
					scene.add( mesh );

				}

				if ( e.data.geometryData.geometryType == LINES || e.data.geometryData.geometryType == POINTS ) {

					const isLines = e.data.geometryData.geometryType == LINES;
					// Types unknown to the defaults get a random colour, hard to read on a map
					const typeColors = Object.entries( e.data.objectColors ).map( ( [ name, colour ] ) => name in defaultObjectColors ? colour : undefined );

					for ( const part of splitByLod( vertices, geometryData ) ) {

						const object = isLines ?
							new CityObjectsLines( citymodel, part.vertices, part, m, context.lineMaterial, typeColors, DEFAULT_LINE_POINT_COLOR ) :
							new CityObjectsPoints( citymodel, part.vertices, part, m, context.pointsMaterial, typeColors, DEFAULT_LINE_POINT_COLOR );

						// Used to switch between geometry and place
						object.userData.lodIdx = part.lod;
						scene.add( object );

					}

				}

				if ( onChunkLoad ) {

					onChunkLoad();

				}

			} else if ( e.data.type === "done" ) {

				context.loading = false;

				if ( data.appearance && data.appearance.materials ) {

					context.meshMaterial.materials = data.appearance.materials;

				}

				if ( onComplete ) {

					onComplete();

				}

			}

		};

		// send message to worker
		worker.postMessage( [ data, { chunkSize: this.chunkSize, objectColors: this.objectColors, lods: this.lods } ] );

		// Parse geometry templates
		// if ( data[ 'geometry-templates' ] ) {

		// 	const templatesGeomData = [];

		// 	const vertices = data[ 'geometry-templates' ][ 'vertices-templates' ];

		// 	const geometryParsers = [
		// 		new TriangleParser( data, Object.keys( data.CityObjects ), this.objectColors, vertices ),
		// 		new LineParser( data, Object.keys( data.CityObjects ), this.objectColors, vertices ),
		// 		new PointParser( data, Object.keys( data.CityObjects ), this.objectColors, vertices )
		// 	];

		// 	for ( const template of data[ 'geometry-templates' ].templates ) {

		// 		for ( const geometryParser of geometryParsers ) {

		// 			geometryParser.lods = this.lods;
		// 			geometryParser.parseGeometry( template, - 1, - 1 );
		// 			this.lods = geometryParser.lods;

		// 			if ( geometryParser.geomData.count() > 0 ) {

		// 				templatesGeomData.push( geometryParser.geomData );

		// 			}

		// 			geometryParser.clean();

		// 		}

		// 	}

		// 	const instances = [];

		// 	for ( let i = 0; i < templatesGeomData.length; i ++ ) {

		// 		instances.push( {
		// 			matrices: [],
		// 			objectIds: [],
		// 			objectType: [],
		// 			geometryIds: []
		// 		} );

		// 	}

		// 	for ( const objectId in data.CityObjects ) {

		// 		const cityObject = data.CityObjects[ objectId ];

		// 		if ( cityObject.geometry && cityObject.geometry.length > 0 ) {

		// 			for ( let i = 0; i < cityObject.geometry.length; i ++ ) {

		// 				const geometry = cityObject.geometry[ i ];

		// 				if ( geometry.type == "GeometryInstance" ) {

		// 					const matrix = new Matrix4();
		// 					matrix.set( ... geometry.transformationMatrix );
		// 					matrix.setPosition( ... data.vertices[ geometry.boundaries[ 0 ] ] );

		// 					instances[ geometry.template ].matrices.push( matrix );
		// 					instances[ geometry.template ].objectIds.push( Object.keys( data.CityObjects ).indexOf( objectId ) );
		// 					instances[ geometry.template ].objectType.push( Object.keys( this.objectColors ).indexOf( cityObject.type ) );
		// 					instances[ geometry.template ].geometryIds.push( i );

		// 				}

		// 			}

		// 		}

		// 	}

		// 	for ( let i = 0; i < templatesGeomData.length; i ++ ) {

		// 		if ( templatesGeomData[ i ].geometryType == TRIANGLES ) {

		// 			const mesh = new CityObjectsInstancedMesh( citymodel, templatesGeomData[ i ].getVertices( vertices ), templatesGeomData[ i ], instances[ i ], m, this.meshMaterial );
		// 			scene.add( mesh );


		// 		} else if ( templatesGeomData[ i ].geometryType == LINES ) {

		// 			for ( let j = 0; j < instances[ i ].matrices.length; j ++ ) {

		// 				templatesGeomData[ i ].setObjectId( instances[ i ].objectIds[ j ] );
		// 				templatesGeomData[ i ].setObjectType( instances[ i ].objectType[ j ] );
		// 				templatesGeomData[ i ].setGeometryIdx( instances[ i ].geometryIds[ j ] );

		// 				const line = new CityObjectsLines( templatesGeomData[ i ].getVertices( vertices ), templatesGeomData[ i ], m, this.lineMaterial );
		// 				line.applyMatrix4( instances[ i ].matrices[ j ] );
		// 				scene.add( line );

		// 			}

		// 		} else if ( templatesGeomData[ i ].geometryType == POINTS ) {

		// 			for ( let j = 0; j < instances[ i ].matrices.length; j ++ ) {

		// 				templatesGeomData[ i ].setObjectId( instances[ i ].objectIds[ j ] );
		// 				templatesGeomData[ i ].setObjectType( instances[ i ].objectType[ j ] );
		// 				templatesGeomData[ i ].setGeometryIdx( instances[ i ].geometryIds[ j ] );

		// 				const line = new CityObjectsPoints( templatesGeomData[ i ].getVertices( vertices ), templatesGeomData[ i ], m, this.pointsMaterial );
		// 				line.applyMatrix4( instances[ i ].matrices[ j ] );
		// 				scene.add( line );

		// 			}

		// 		}

		// 	}

		// }

	}

}
