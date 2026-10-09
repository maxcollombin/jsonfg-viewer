import { LINES, GeometryData } from './GeometryData.js';
import { BaseParser } from './BaseParser.js';

export class LineParser extends BaseParser {

	constructor( json, objectIds, objectColors ) {

		super( json, objectIds, objectColors );

		this.geomData = new GeometryData( LINES );

	}

	clean() {

		this.geomData = new GeometryData( LINES );

	}

	/**
	 * Returns the geometry as a list of lines (each an array of positions), or
	 * null if the geometry is not a line type.
	 */
	getLines( geometry ) {

		if ( geometry.type == "LineString" ) {

			return [ geometry.coordinates ];

		} else if ( geometry.type == "MultiLineString" ) {

			return geometry.coordinates;

		}

		return null;

	}

	parseGeometry( geometry, objectId, lod ) {

		const lines = this.getLines( geometry );

		if ( ! lines ) {

			return;

		}

		const cityObj = this.json.features[ objectId ];

		const idIdx = cityObj ? this.getObjectIdx( objectId ) : - 1;
		const objType = cityObj ? this.getObjectTypeIdx( cityObj.featureType ) : - 1;
		const lodIdx = this.getLodIndex( lod );

		// Lines are drawn as segments, so every interior vertex is emitted twice.
		for ( let i = 0; i < lines.length; i ++ ) {

			for ( let j = 0; j < lines[ i ].length - 1; j ++ ) {

				this.geomData.addVertex( this.to3d( lines[ i ][ j ] ), idIdx, objType, i, lodIdx );
				this.geomData.addVertex( this.to3d( lines[ i ][ j + 1 ] ), idIdx, objType, i, lodIdx );

			}

		}

	}

}
