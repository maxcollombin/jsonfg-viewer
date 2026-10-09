import { BufferAttribute,
		 BufferGeometry,
		 Color,
		 Float32BufferAttribute,
		 Int32BufferAttribute,
		 LineSegments } from 'three';

export class CityObjectsLines extends LineSegments {

	/**
	 * @param {Array} typeColors Hex colour of each object type, indexed by type
	 * @param {Number} defaultColor Hex colour used for types without a colour
	 */
	constructor( citymodel, vertices, geometryData, matrix, material, typeColors, defaultColor ) {

		const geom = new BufferGeometry();

		const vertexArray = new Float32Array( vertices );
		geom.setAttribute( 'position', new BufferAttribute( vertexArray, 3 ) );
		const idsArray = new Uint16Array( geometryData.objectIds );
		geom.setAttribute( 'objectid', new BufferAttribute( idsArray, 1 ) );
		const typeArray = new Uint8Array( geometryData.objectType );
		geom.setAttribute( 'type', new Int32BufferAttribute( typeArray, 1 ) );
		const lodIdsArray = new Int8Array( geometryData.lodIds );
		geom.setAttribute( 'lodid', new BufferAttribute( lodIdsArray, 1 ) );
		const boundaryIdsArray = new Float32Array( geometryData.boundaryIds );
		geom.setAttribute( 'boundaryid', new BufferAttribute( boundaryIdsArray, 1 ) );

		const colors = [];
		const colour = new Color();
		for ( const type of geometryData.objectType ) {

			colour.setHex( typeColors[ type ] !== undefined ? typeColors[ type ] : defaultColor );
			colors.push( colour.r, colour.g, colour.b );

		}
		geom.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );

		if ( matrix ) {

			geom.applyMatrix4( matrix );

		}

		super( geom, material );

		this.citymodel = citymodel;

		this.isCityObject = true;
		this.isCityObjectLines = true;

	}

}
