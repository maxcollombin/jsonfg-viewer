import {
	Vector3
} from 'three';
import earcut from 'earcut';

import { TRIANGLES, GeometryData } from './GeometryData.js';
import { BaseParser } from './BaseParser.js';

export class TriangleParser extends BaseParser {

	constructor( json, objectIds, objectColors, vertices ) {

		super( json, objectIds, objectColors );

		// if ( vertices ) {

		// 	this.vertices = vertices;

		// } else {

		// 	this.vertices = this.json.vertices;

		// }

		this.geomData = new GeometryData( TRIANGLES );

	}

	clean() {

		this.geomData = new GeometryData( TRIANGLES );

	}

	/**
	 * Flattens the given geometry, meaning that a Solid or MultiSolid will be
	 * basically converted to a MultiSuface
	 */
	flattenGeometry( geometry ) {

		const geometryType = geometry.type;

		if ( geometryType == "Polygon" ) {

			const newGeometry = Object.assign( {}, geometry );

			newGeometry.coordinates = [geometry.coordinates];

			return newGeometry;

		} else if ( geometryType == "MultiPolygon" ) {

			return geometry;

		} else if ( geometryType == "Polyhedron" ) {

			const newGeometry = Object.assign( {}, geometry );

			newGeometry.coordinates = geometry.coordinates.flat( 1 );

			return newGeometry;

		} else if ( geometryType == "MultiPolyhedron" ) {

			const newGeometry = Object.assign( {}, geometry );

			newGeometry.coordinates = geometry.coordinates.flat( 2 );

			return newGeometry;

		} else if ( geometryType == "Prism" ) {

			return this.flattenPrism( geometry );

		} else if ( [ "LineString", "MultiLineString", "Point", "MultiPoint" ].includes( geometryType ) ) {

			// Drawn by the line and point parsers
			return;

		} else {

			console.error("Unsupport geometry type: %s", geometryType);

		}

	}

	/**
	 * Converts a Prism with a Polygon base to a MultiPolygon: a bottom face at
	 * `lower` (default 0), a top face at `upper` and one quad per base edge.
	 */
	flattenPrism( geometry ) {

		if ( ! geometry.base || geometry.base.type != "Polygon" ) {

			console.error("Unsupport Prism base type: %s", geometry.base && geometry.base.type);
			return;

		}

		const lower = geometry.lower || 0;
		const upper = geometry.upper;
		const at = ( p, z ) => [ p[ 0 ], p[ 1 ], z ];
		const rings = geometry.base.coordinates;

		const surfaces = [
			rings.map( ring => ring.map( p => at( p, lower ) ).reverse() ),
			rings.map( ring => ring.map( p => at( p, upper ) ) )
		];

		for ( const ring of rings ) {

			for ( let i = 0; i < ring.length - 1; i ++ ) {

				const a = ring[ i ];
				const b = ring[ i + 1 ];
				surfaces.push( [ [ at( a, lower ), at( b, lower ), at( b, upper ), at( a, upper ), at( a, lower ) ] ] );

			}

		}

		const newGeometry = Object.assign( {}, geometry );

		newGeometry.coordinates = surfaces;

		return newGeometry;

	}

	parseGeometry( geometry, objectId , lod ) {

		// console.log("Parsing object id %d of lod %s", objectId, lod);

		const cityObj = this.json.features[ objectId ];

		const idIdx = cityObj ? this.getObjectIdx( objectId ) : - 1;
		const objType = cityObj ? this.getObjectTypeIdx( cityObj.featureType ) : - 1;
		const lodIdx = this.getLodIndex( lod );

		// We flatten the geometry to a MultiSurface, basically, so that it's
		// easily parsable.
		const flatGeometry = this.flattenGeometry( geometry );

		if ( flatGeometry ) {

			this.parseShell( flatGeometry, idIdx, objType, lodIdx );

		}

	}

	parseShell( geometry, idIdx, objType, lodIdx ) {

		const boundaries = geometry.coordinates;
		// const semantics = geometry.semantics ? geometry.semantics.values : [];
		// const surfaces = geometry.semantics ? geometry.semantics.surfaces : [];
		const material = geometry.material ? geometry.material : {};
		// const texture = geometry.texture ? geometry.texture : {};

		// console.log(boundaries);
		// Contains the boundary but with the right verticeId
		for ( let i = 0; i < boundaries.length; i ++ ) {

			let boundary = [];
			let holes = [];

			// const surfaceType = this.getSurfaceTypeIdx( i, semantics, surfaces );
			const materialValue = this.getSurfaceMaterials( i, material );

			for ( let j = 0; j < boundaries[ i ].length; j ++ ) {

				if ( boundary.length > 0 ) {

					holes.push( boundary.length );

				}

				// const new_boundary = this.extractLocalIndices( geom, boundaries[ i ][ j ], vertices, json );
				// boundary.push( ...new_boundary );
				boundary.push( ...boundaries[ i ][ j ] );

			}
			// console.log(boundary);

			if ( boundary.length == 3 ) {

				for ( let n = 0; n < 3; n ++ ) {

					this.geomData.addVertex( boundary[ n ],
											 idIdx,
											 objType,
											//  surfaceType,
											 i,
											 lodIdx,
											 materialValue);
											//  this.getTextureData( i, n, holes, texture ) );

				}


			} else if ( boundary.length > 3 ) {

				//create list of points
				// let pList = [];
				// for ( let k = 0; k < boundary.length; k ++ ) {

				// 	pList.push( {
				// 		x: boundary[ k ] [ 0 ],
				// 		y: boundary[ k ] [ 1 ],
				// 		z: boundary[ k ] [ 2 ]
				// 	} );

				// }

				//get normal of these points
				const normal = this.getNewellsNormal( boundary );

				//convert to 2d (for triangulation)
				let pv = [];
				for ( let k = 0; k < boundary.length; k ++ ) {

					const re = this.to_2d( boundary[ k ], normal );
					pv.push( re.x );
					pv.push( re.y );

				}

				//triangulate
				const tr = earcut( pv, holes, 2 );

				// create faces based on triangulation
				for ( let k = 0; k < tr.length; k += 3 ) {

					for ( let n = 0; n < 3; n ++ ) {

						const vertexId = tr[ k + n ];

						this.geomData.addVertex( boundary[ vertexId ],
											 	 idIdx,
												 objType,
												 i,
												 lodIdx,
												 materialValue);
												//  this.getTextureData( i, tr[ k + n ], holes, texture ) );

					}

				}

			}

		}

	}

	getNewellsNormal( indices ) {

		// find normal with Newell's method
		let n = [ 0.0, 0.0, 0.0 ];

		for ( let i = 0; i < indices.length; i ++ ) {

			let nex = i + 1;

			if ( nex == indices.length ) {

				nex = 0;

			}

			n[ 0 ] = n[ 0 ] + ( ( indices[ i ][1] - indices[ nex ][1] ) * ( indices[ i ][2] + indices[ nex ][2] ) );
			n[ 1 ] = n[ 1 ] + ( ( indices[ i ][2] - indices[ nex ][2] ) * ( indices[ i ][0] + indices[ nex ][0] ) );
			n[ 2 ] = n[ 2 ] + ( ( indices[ i ][0] - indices[ nex ][0] ) * ( indices[ i ][1] + indices[ nex ][1] ) );

		}

		let b = new Vector3( n[ 0 ], n[ 1 ], n[ 2 ] );
		return ( b.normalize() );

	}

	to_2d( p, n ) {

		p = new Vector3( p[0], p[1], p[2] );
		let x3 = new Vector3( 1.1, 1.1, 1.1 );
		if ( x3.distanceTo( n ) < 0.01 ) {

			x3.add( new Vector3( 1.0, 2.0, 3.0 ) );

		}

		let tmp = x3.dot( n );
		let tmp2 = n.clone();
		tmp2.multiplyScalar( tmp );
		x3.sub( tmp2 );
		x3.normalize();
		let y3 = n.clone();
		y3.cross( x3 );
		let x = p.dot( x3 );
		let y = p.dot( y3 );
		let re = { x: x, y: y };
		return re;

	}

}
