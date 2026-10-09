import { POINTS, GeometryData } from './GeometryData.js';
import { BaseParser } from './BaseParser.js';

export class PointParser extends BaseParser {

	constructor( json, objectIds, objectColors ) {

		super( json, objectIds, objectColors );

		this.geomData = new GeometryData( POINTS );

	}

	clean() {

		this.geomData = new GeometryData( POINTS );

	}

	/**
	 * Returns the geometry as a list of positions, or null if the geometry is
	 * not a point type.
	 */
	getPoints( geometry ) {

		if ( geometry.type == "Point" ) {

			return [ geometry.coordinates ];

		} else if ( geometry.type == "MultiPoint" ) {

			return geometry.coordinates;

		}

		return null;

	}

	parseGeometry( geometry, objectId, lod ) {

		const points = this.getPoints( geometry );

		if ( ! points ) {

			return;

		}

		const cityObj = this.json.features[ objectId ];

		const idIdx = cityObj ? this.getObjectIdx( objectId ) : - 1;
		const objType = cityObj ? this.getObjectTypeIdx( cityObj.featureType ) : - 1;
		const lodIdx = this.getLodIndex( lod );

		for ( let i = 0; i < points.length; i ++ ) {

			this.geomData.addVertex( this.to3d( points[ i ] ), idIdx, objType, i, lodIdx );

		}

	}

}
